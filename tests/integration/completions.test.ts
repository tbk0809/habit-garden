import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import * as service from "../../src/features/habits/service.ts";
import { dashboardForSession } from "../../src/features/dashboard/read.ts";
import { completionHarness } from "../helpers/completion.ts";
import { createSessionFixture } from "../helpers/session.ts";

const complete: typeof service.completeHabitForSession = (...args) => {
  assert.equal(
    typeof service.completeHabitForSession,
    "function",
    "Completion service must exist",
  );
  return service.completeHabitForSession(...args);
};
type Harness = Awaited<ReturnType<typeof completionHarness>>;
async function using(run: (h: Harness) => Promise<void>) {
  const h = await completionHarness();
  try {
    await run(h);
  } finally {
    await h.close();
  }
}
function success<T>(
  result: { ok: true; data: T } | { ok: false; error: unknown },
): T {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("Expected success");
  return result.data;
}
function error(
  result: { ok: boolean; error?: { code: string; correlationId?: string } },
  code: string,
) {
  assert.equal(result.ok, false);
  assert.equal(result.error?.code, code);
}

test("built-in DB clock completion persists once; duplicate after archive preserves all retained state", () =>
  using(async (h) => {
    const o = await h.owner();
    const command = { habitId: o.habitId, expectedLocalDate: o.date };
    const first = success(await complete(h.db, o.session, command));
    assert.equal(first.status, "completed");
    assert.equal(first.dashboard.lifetimeCompletionCount, 1);
    assert.deepEqual(first.dashboard.habits, [
      {
        id: o.habitId,
        title: "Read",
        completedToday: true,
        currentStreak: 1,
        bestStreak: 1,
      },
    ]);
    const before = await h.stored(o.user.id);
    assert.equal(
      new Date(before.logs[0].completed_at).toISOString(),
      first.dashboard.asOf,
    );
    assert.equal(
      success(await complete(h.db, o.session, command)).status,
      "already_completed",
    );
    assert.deepEqual(await h.stored(o.user.id), before);
    success(
      await service.archiveHabitForSession(h.db, o.session, {
        habitId: o.habitId,
      }),
    );
    const replay = success(await complete(h.db, o.session, command));
    assert.equal(replay.status, "already_completed");
    assert.deepEqual(replay.dashboard.habits, []);
    assert.deepEqual(await h.stored(o.user.id), before);
  }));

test("ownership, strict commands, stale date, sessions and archive rejection never write", () =>
  using(async (h) => {
    const o = await h.owner(),
      other = await h.owner();
    const c = { habitId: o.habitId, expectedLocalDate: o.date };
    const before = await h.stored(o.user.id);
    const absent = await complete(h.db, o.session, {
      ...c,
      habitId: randomUUID(),
    });
    assert.deepEqual(
      await complete(h.db, o.session, { ...c, habitId: other.habitId }),
      absent,
    );
    error(absent, "NOT_FOUND");
    for (const command of [
      { ...c, expectedLocalDate: "2026-02-29" },
      { ...c, userId: other.user.id },
      { ...c, asOf: "forged" },
      { ...c, count: 50 },
    ])
      error(await complete(h.db, o.session, command), "VALIDATION_ERROR");
    const expired = await createSessionFixture(new Date(Date.now() - 60000));
    for (const session of [
      await h.session(),
      await h.session(expired.cookie),
      {
        user: { id: o.user.id },
        expires: new Date(Date.now() - 1000).toISOString(),
      },
    ])
      error(await complete(h.db, session, c), "UNAUTHENTICATED");
    const newcomer = await createSessionFixture();
    error(
      await complete(h.db, await h.session(newcomer.cookie), c),
      "ONBOARDING_REQUIRED",
    );
    error(
      await complete(h.db, o.session, {
        ...c,
        expectedLocalDate: "2000-01-01",
      }),
      "DAY_ROLLED_OVER",
    );
    success(
      await service.archiveHabitForSession(h.db, o.session, {
        habitId: o.habitId,
      }),
    );
    error(await complete(h.db, o.session, c), "HABIT_ARCHIVED");
    assert.deepEqual(await h.stored(o.user.id), before);
  }));

test("same-day concurrency serializes one reward with actual user-lock blocking", () =>
  using(async (h) => {
    const o = await h.owner();
    const a = await h.scoped(`${o.date}T12:00:00Z`),
      b = await h.scoped(`${o.date}T12:00:01Z`);
    const gate = 71001;
    await h.gateTrigger("habit_logs", o.user.id, gate);
    await h.admin.query("select pg_advisory_lock($1)", [gate]);
    const command = { habitId: o.habitId, expectedLocalDate: o.date };
    const pendingA = complete(a.db, o.session, command);
    await h.blocked(a.pid);
    const pendingB = complete(b.db, o.session, command);
    const query = await h.blocked(b.pid, a.pid);
    assert.match(query, /users/i);
    assert.doesNotMatch(query, /clock_timestamp|now\(/i);
    assert.equal(b.notices.length, 0);
    await h.admin.query("select pg_advisory_unlock($1)", [gate]);
    const first = success(await pendingA),
      second = success(await pendingB);
    assert.deepEqual(
      [first.status, second.status],
      ["completed", "already_completed"],
    );
    assert.equal(first.dashboard.lifetimeCompletionCount, 1);
    assert.equal(second.dashboard.lifetimeCompletionCount, 1);
    const stored = await h.stored(o.user.id);
    assert.equal(stored.logs.length, 1);
    assert.equal(stored.streaks[0].run_length, 1);
    assert.equal(stored.garden.lifetime_completion_count, 1);
    assert.equal(
      new Date(stored.logs[0].completed_at).toISOString(),
      new Date(`${o.date}T12:00:00Z`).toISOString(),
    );
  }));

test("post-lock midnight uses one later database clock and stale retry cannot become tomorrow's completion", () =>
  using(async (h) => {
    const o = await h.owner();
    const today = (
      await h.pool.query(
        "select (pg_catalog.clock_timestamp() at time zone 'UTC')::date::text as d,((pg_catalog.clock_timestamp() at time zone 'UTC')::date+1)::text as next",
      )
    ).rows[0];
    const a = await h.scoped(`${today.d}T23:59:59Z`);
    const before = await h.stored(o.user.id);
    await h.admin.query("begin");
    await h.admin.query("select id from users where id=$1 for update", [
      o.user.id,
    ]);
    const pending = complete(a.db, o.session, {
      habitId: o.habitId,
      expectedLocalDate: today.d,
    });
    const lockQuery = await h.blocked(a.pid);
    assert.match(lockQuery, /users/i);
    assert.doesNotMatch(lockQuery, /clock_timestamp|now\(/i);
    assert.equal(a.notices.length, 0);
    await h.setClock(a.pid, `${today.next}T00:00:01Z`);
    await h.admin.query("commit");
    error(await pending, "DAY_ROLLED_OVER");
    assert.deepEqual(await h.stored(o.user.id), before);
    assert.equal(a.notices.length, 1);
    assert.doesNotMatch(a.notices[0]!, /for update/i);
    const fresh = success(await dashboardForSession(a.db, o.session));
    assert.equal(fresh.localDate, today.next);
    success(
      await complete(a.db, o.session, {
        habitId: o.habitId,
        expectedLocalDate: fresh.localDate,
      }),
    );
    const after = await h.stored(o.user.id);
    error(
      await complete(a.db, o.session, {
        habitId: o.habitId,
        expectedLocalDate: today.d,
      }),
      "DAY_ROLLED_OVER",
    );
    assert.deepEqual(await h.stored(o.user.id), after);
  }));

test("different habits share total serialization while another owner can commit independently", () =>
  using(async (h) => {
    const o = await h.owner(),
      other = await h.owner();
    const second = success(
      await service.createHabitForSession(h.db, o.session, { title: "Walk" }),
    );
    await h.seedRun(o.user.id, o.habitId, 4, "2030-01-30");
    const a = await h.scoped("2030-01-31T12:00:00Z"),
      b = await h.scoped("2030-01-31T12:00:01Z");
    const gate = 71002;
    await h.gateTrigger("habit_logs", o.user.id, gate);
    await h.admin.query("select pg_advisory_lock($1)", [gate]);
    const pendingA = complete(a.db, o.session, {
      habitId: o.habitId,
      expectedLocalDate: "2030-01-31",
    });
    await h.blocked(a.pid);
    const pendingB = complete(b.db, o.session, {
      habitId: second.habitId,
      expectedLocalDate: "2030-01-31",
    });
    await h.blocked(b.pid, a.pid);
    assert.equal(
      success(
        await complete(h.db, other.session, {
          habitId: other.habitId,
          expectedLocalDate: other.date,
        }),
      ).dashboard.lifetimeCompletionCount,
      1,
    );
    await h.admin.query("select pg_advisory_unlock($1)", [gate]);
    const first = success(await pendingA),
      next = success(await pendingB);
    assert.deepEqual(
      [
        first.dashboard.lifetimeCompletionCount,
        next.dashboard.lifetimeCompletionCount,
      ],
      [5, 6],
    );
    assert.equal(first.dashboard.plants[1]?.unlocked, true);
    assert.deepEqual(first.dashboard.plants[1], {
      plantId: "daisy",
      name: "Daisy",
      slotIndex: 1,
      unlockAt: 5,
      unlocked: true,
      growthPoints: 0,
      stage: "sprout",
      stageIndex: 0,
    });
    const stored = await h.stored(o.user.id);
    assert.equal(stored.logs.length, 6);
    assert.equal(
      stored.plants.filter((p: { plant_id: string }) => p.plant_id === "daisy")
        .length,
      1,
    );
    assert.equal(
      stored.plants.find((p: { plant_id: string }) => p.plant_id === "daisy")
        .unlocked_at,
      "2030-01-31T12:00:00+00:00",
    );
  }));

for (const completionFirst of [false, true])
  test(`${completionFirst ? "completion" : "archive"}-first race retains precisely the accepted rewards`, () =>
    using(async (h) => {
      const o = await h.owner();
      const a = await h.scoped(`${o.date}T20:00:00Z`),
        b = await h.scoped(`${o.date}T20:00:01Z`);
      const gate = completionFirst ? 71003 : 71004;
      await h.gateTrigger(
        completionFirst ? "habit_logs" : "habits",
        o.user.id,
        gate,
      );
      await h.admin.query("select pg_advisory_lock($1)", [gate]);
      const command = { habitId: o.habitId, expectedLocalDate: o.date };
      const first = completionFirst
        ? complete(a.db, o.session, command)
        : service.archiveHabitForSession(a.db, o.session, {
            habitId: o.habitId,
          });
      await h.blocked(a.pid);
      const second = completionFirst
        ? service.archiveHabitForSession(b.db, o.session, {
            habitId: o.habitId,
          })
        : complete(b.db, o.session, command);
      await h.blocked(b.pid, a.pid);
      await h.admin.query("select pg_advisory_unlock($1)", [gate]);
      assert.equal((await first).ok, true);
      if (completionFirst) assert.equal((await second).ok, true);
      else error(await second, "HABIT_ARCHIVED");
      const retained = await h.stored(o.user.id);
      assert.equal(retained.logs.length, completionFirst ? 1 : 0);
      assert.equal(
        retained.garden.lifetime_completion_count,
        completionFirst ? 1 : 0,
      );
      assert.deepEqual(
        success(await dashboardForSession(h.db, o.session)).habits,
        [],
      );
    }));

test("capture before midnight remains one coherent accepted instant after the write gate crosses midnight", () =>
  using(async (h) => {
    const o = await h.owner(),
      a = await h.scoped("2030-01-31T23:59:59Z");
    const gate = 71005;
    await h.gateTrigger("habit_logs", o.user.id, gate);
    await h.admin.query("select pg_advisory_lock($1)", [gate]);
    const pending = complete(a.db, o.session, {
      habitId: o.habitId,
      expectedLocalDate: "2030-01-31",
    });
    await h.blocked(a.pid);
    assert.equal(a.notices.length, 1);
    await h.setClock(a.pid, "2030-02-01T00:00:01Z");
    await h.admin.query("select pg_advisory_unlock($1)", [gate]);
    const accepted = success(await pending);
    assert.equal(accepted.dashboard.asOf, "2030-01-31T23:59:59.000Z");
    assert.equal(accepted.dashboard.localDate, "2030-01-31");
    assert.equal(a.notices.length, 1);
    const stored = await h.stored(o.user.id);
    assert.equal(stored.logs[0].local_date, "2030-01-31");
    assert.equal(
      new Date(stored.logs[0].completed_at).toISOString(),
      accepted.dashboard.asOf,
    );
    error(
      await complete(a.db, o.session, {
        habitId: o.habitId,
        expectedLocalDate: "2030-01-31",
      }),
      "DAY_ROLLED_OVER",
    );
    assert.deepEqual(await h.stored(o.user.id), stored);
    const refresh = success(await dashboardForSession(a.db, o.session));
    assert.equal(refresh.localDate, "2030-02-01");
    const explicit = success(
      await complete(a.db, o.session, {
        habitId: o.habitId,
        expectedLocalDate: refresh.localDate,
      }),
    );
    assert.equal(explicit.dashboard.lifetimeCompletionCount, 2);
    assert.equal(explicit.dashboard.habits[0]?.currentStreak, 2);
  }));

test("all unlock thresholds grant exactly one plant with zero initial points", () =>
  using(async (h) => {
    for (const [total, id, index] of [
      [4, "daisy", 1],
      [14, "sunflower", 2],
      [29, "cherry", 3],
    ] as const) {
      const o = await h.owner();
      await h.seedRun(o.user.id, o.habitId, total, "2030-01-30");
      const a = await h.scoped("2030-01-31T12:00:00Z");
      const result = success(
        await complete(a.db, o.session, {
          habitId: o.habitId,
          expectedLocalDate: "2030-01-31",
        }),
      );
      assert.equal(result.dashboard.lifetimeCompletionCount, total + 1);
      const plant = result.dashboard.plants[index];
      assert.equal(plant?.plantId, id);
      assert.equal(plant?.unlocked, true);
      if (plant?.unlocked) {
        assert.equal(plant.growthPoints, 0);
        assert.equal(plant.stage, "sprout");
      }
      assert.equal(result.dashboard.habits[0]?.currentStreak, total + 1);
    }
  }));

test("a genuine deferred COMMIT failure rolls back log, streak, total and unlock before any success escapes", () =>
  using(async (h) => {
    const o = await h.owner();
    await h.seedRun(o.user.id, o.habitId, 4, "2030-01-30");
    const a = await h.scoped("2030-01-31T12:00:00Z");
    const before = await h.stored(o.user.id);
    await h.admin.query(
      `create function ${h.ns}.fail_commit() returns trigger language plpgsql as $$ begin if new.user_id='${o.user.id}'::uuid then if (select count(*) from public.habit_logs where user_id=new.user_id)<>5 or not exists(select 1 from public.habit_streaks where habit_id=new.habit_id and user_id=new.user_id and run_length=5 and longest_streak=5 and last_completed_on='2030-01-31'::date) or not exists(select 1 from public.garden_state where user_id=new.user_id and lifetime_completion_count=5) or not exists(select 1 from public.user_plants where user_id=new.user_id and plant_id='daisy') then raise exception 'fault precondition failed'; end if; raise notice 't7_commit_four_states'; raise exception 'private deferred failure'; end if; return new; end $$`,
    );
    await h.admin.query(
      `create constraint trigger ${h.ns}_commit after insert on habit_logs deferrable initially deferred for each row execute function ${h.ns}.fail_commit()`,
    );
    const command = { habitId: o.habitId, expectedLocalDate: "2030-01-31" };
    const result = await complete(a.db, o.session, command);
    error(result, "SERVICE_UNAVAILABLE");
    if (!result.ok)
      assert.match(result.error.correlationId!, /^[0-9a-f-]{36}$/);
    assert.equal(
      a.notices.filter((n) => n === "t7_commit_four_states").length,
      1,
      "COMMIT fault must first verify all four staged writes",
    );
    assert.equal(JSON.stringify(result).includes("private deferred"), false);
    assert.deepEqual(await h.stored(o.user.id), before);
    await h.admin.query(`drop trigger ${h.ns}_commit on habit_logs`);
    assert.equal(
      success(await complete(a.db, o.session, command)).status,
      "completed",
    );
    assert.equal(
      success(await complete(a.db, o.session, command)).status,
      "already_completed",
    );
  }));

test("stored-zone civil days handle 23h, 25h, repeated DST hour and Kuala Lumpur midnight", () =>
  using(async (h) => {
    for (const [zone, first, next, date1, date2] of [
      [
        "America/New_York",
        "2026-03-08T05:00:00Z",
        "2026-03-09T04:00:00Z",
        "2026-03-08",
        "2026-03-09",
      ],
      [
        "America/New_York",
        "2026-11-01T04:00:00Z",
        "2026-11-02T05:00:00Z",
        "2026-11-01",
        "2026-11-02",
      ],
      [
        "America/New_York",
        "2026-11-01T05:30:00Z",
        "2026-11-01T06:30:00Z",
        "2026-11-01",
        "2026-11-01",
      ],
      [
        "Asia/Kuala_Lumpur",
        "2026-10-23T15:59:59Z",
        "2026-10-23T16:00:01Z",
        "2026-10-23",
        "2026-10-24",
      ],
    ]) {
      const o = await h.owner(zone);
      const a = await h.scoped(first!);
      assert.equal(
        success(
          await complete(a.db, o.session, {
            habitId: o.habitId,
            expectedLocalDate: date1,
          }),
        ).dashboard.localDate,
        date1,
      );
      await h.setClock(a.pid, next!);
      const result = success(
        await complete(a.db, o.session, {
          habitId: o.habitId,
          expectedLocalDate: date2,
        }),
      );
      assert.equal(
        result.status,
        date1 === date2 ? "already_completed" : "completed",
      );
      assert.equal(result.dashboard.localDate, date2);
      assert.equal(
        result.dashboard.habits[0]?.currentStreak,
        date1 === date2 ? 1 : 2,
      );
    }
  }));

test("dashboard statement keeps its old MVCC snapshot while a threshold completion commits", () =>
  using(async (h) => {
    const o = await h.owner();
    await h.seedRun(o.user.id, o.habitId, 4, "2030-01-30");
    const gate = 71006;
    const reader = await h.scoped("2030-01-31T12:00:00Z", gate),
      writer = await h.scoped("2030-01-31T12:00:01Z");
    await h.admin.query("select pg_advisory_lock($1)", [gate]);
    const pending = dashboardForSession(reader.db, o.session);
    await h.blocked(reader.pid);
    const written = success(
      await complete(writer.db, o.session, {
        habitId: o.habitId,
        expectedLocalDate: "2030-01-31",
      }),
    );
    assert.equal(written.dashboard.lifetimeCompletionCount, 5);
    await h.admin.query("select pg_advisory_unlock($1)", [gate]);
    const old = success(await pending);
    assert.equal(old.lifetimeCompletionCount, 4);
    assert.equal(old.plants[1]?.unlocked, false);
    assert.equal(old.habits[0]?.completedToday, false);
    await h.setClock(reader.pid, "2030-01-31T12:00:02Z");
    const fresh = success(await dashboardForSession(reader.db, o.session));
    assert.equal(fresh.lifetimeCompletionCount, 5);
    assert.equal(fresh.plants[1]?.unlocked, true);
    assert.equal(fresh.habits[0]?.completedToday, true);
  }));

test("independent retained-log reconstruction agrees with caches across gaps, archived history and empty habits", () =>
  using(async (h) => {
    const o = await h.owner(),
      other = await h.owner();
    const a = await h.scoped("2030-02-01T12:00:00Z");
    await h.seedRun(o.user.id, o.habitId, 4, "2030-01-04");
    for (const [instant, date] of [
      ["2030-01-30T12:00:00Z", "2030-01-30"],
      ["2030-01-31T12:00:00Z", "2030-01-31"],
    ]) {
      await h.setClock(a.pid, instant!);
      success(
        await complete(a.db, o.session, {
          habitId: o.habitId,
          expectedLocalDate: date,
        }),
      );
    }
    success(
      await service.archiveHabitForSession(h.db, o.session, {
        habitId: o.habitId,
      }),
    );
    success(
      await service.createHabitForSession(h.db, o.session, { title: "Empty" }),
    );
    success(
      await complete(h.db, other.session, {
        habitId: other.habitId,
        expectedLocalDate: other.date,
      }),
    );
    const oracle = await h.pool.query(
      `with dated as (select habit_id,local_date,local_date-(row_number() over(partition by habit_id order by local_date))::int as island from habit_logs where user_id=$1),runs as (select habit_id,count(*)::int as n,max(local_date) as last from dated group by habit_id,island), rebuilt as (select habit_id,max(n) as best,(array_agg(n order by last desc))[1] as run,max(last)::text as last from runs group by habit_id) select h.id,coalesce(r.best,0) as best,coalesce(r.run,0) as run,r.last,s.longest_streak,s.run_length,s.last_completed_on::text from habits h left join rebuilt r on r.habit_id=h.id join habit_streaks s on s.habit_id=h.id and s.user_id=h.user_id where h.user_id=$1 order by h.id`,
      [o.user.id],
    );
    assert.equal(oracle.rows.length, 2);
    for (const row of oracle.rows) {
      assert.equal(row.best, row.longest_streak);
      assert.equal(row.run, row.run_length);
      assert.equal(row.last, row.last_completed_on);
    }
    const stored = await h.stored(o.user.id);
    assert.equal(stored.logs.length, 6);
    assert.equal(stored.garden.lifetime_completion_count, 6);
    assert.equal(
      stored.streaks.find((s: { habit_id: string }) => s.habit_id === o.habitId)
        .longest_streak,
      4,
    );
    assert.equal(
      stored.streaks.find((s: { habit_id: string }) => s.habit_id === o.habitId)
        .run_length,
      2,
    );
    await h.setClock(a.pid, "2030-02-01T12:00:00Z");
    const dashboard = success(await dashboardForSession(a.db, o.session));
    assert.equal(dashboard.lifetimeCompletionCount, 6);
    assert.equal(dashboard.habits.length, 1);
    assert.equal(dashboard.habits[0]?.currentStreak, 0);
    await h.admin.query(
      "update garden_state set lifetime_completion_count=0 where user_id=$1",
      [o.user.id],
    );
    error(await dashboardForSession(a.db, o.session), "SERVICE_UNAVAILABLE");
    const inconsistent = await h.stored(o.user.id);
    error(
      await complete(a.db, o.session, {
        habitId: dashboard.habits[0]!.id,
        expectedLocalDate: "2030-02-01",
      }),
      "SERVICE_UNAVAILABLE",
    );
    assert.deepEqual(await h.stored(o.user.id), inconsistent);
  }));
