import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { Auth } from "@auth/core";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema/index.ts";
import { createAuthConfig } from "../../src/features/auth/config.ts";
import { confirmTimeZoneForSession } from "../../src/features/auth/onboarding.ts";
import {
  archiveHabitForSession,
  createHabitForSession,
} from "../../src/features/habits/service.ts";
import { dashboardForSession } from "../../src/features/dashboard/read.ts";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";
import { createSessionFixture } from "../helpers/session.ts";

assertLocalDatabaseTarget(
  process.env.TEST_DATABASE_URL,
  process.env.NODE_ENV,
  "test",
);
assertLocalDatabaseTarget(
  process.env.TEST_RUNTIME_DATABASE_URL,
  process.env.NODE_ENV,
  "test",
);
const pool = new pg.Pool({
  connectionString: process.env.TEST_RUNTIME_DATABASE_URL,
  application_name: "task6-habits",
  max: 12,
});
const db = drizzle(pool, { schema });
after(() => pool.end());
const env = {
  DATABASE_URL: process.env.TEST_RUNTIME_DATABASE_URL!,
  AUTH_SECRET: "fictional-test-secret-with-at-least-32-characters",
  AUTH_GITHUB_ID: "fictional-client-id",
  AUTH_GITHUB_SECRET: "fictional-client-secret",
  AUTH_URL: "http://localhost:3000",
};

async function resolveSession(cookie?: string) {
  const response = await Auth(
    new Request("http://localhost:3000/api/auth/session", {
      headers: cookie ? { cookie } : {},
    }),
    createAuthConfig(db, env),
  );
  assert.equal(response.status, 200);
  return response.json();
}
async function owner(initialized = true) {
  const fixture = await createSessionFixture();
  const session = await resolveSession(fixture.cookie);
  if (initialized) {
    assert.equal(
      (await confirmTimeZoneForSession(db, session, { timeZone: "UTC" })).ok,
      true,
    );
  }
  return { ...fixture, session };
}
async function adminClient() {
  const client = new pg.Client({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  await client.connect();
  return client;
}

test("creation persists trimmed owned habit and zero streak atomically with full authoritative projection", async () => {
  const fixture = await owner();
  const other = await owner();
  const privateHabit = await createHabitForSession(db, other.session, {
    title: "Private",
  });
  assert.equal(privateHabit.ok, true);
  const result = await createHabitForSession(db, fixture.session, {
    title: "  Read  ",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.data.dashboard.habits, [
    {
      id: result.data.habitId,
      title: "Read",
      completedToday: false,
      currentStreak: 0,
      bestStreak: 0,
    },
  ]);
  assert.equal(result.data.dashboard.lifetimeCompletionCount, 0);
  assert.equal(result.data.dashboard.plants.length, 4);
  assert.equal(result.data.dashboard.plants[0]?.unlocked, true);
  const stored = await pool.query(
    "select h.user_id,h.created_at,h.updated_at,s.user_id as streak_owner,s.run_length,s.longest_streak,s.last_completed_on,($2::timestamptz at time zone 'UTC')::date::text as date from habits h join habit_streaks s on s.habit_id=h.id and s.user_id=h.user_id where h.id=$1 and h.user_id=$3",
    [result.data.habitId, result.data.dashboard.asOf, fixture.user.id],
  );
  assert.equal(stored.rows[0].user_id, fixture.user.id);
  assert.equal(stored.rows[0].streak_owner, fixture.user.id);
  assert.equal(stored.rows[0].run_length, 0);
  assert.equal(stored.rows[0].longest_streak, 0);
  assert.equal(stored.rows[0].last_completed_on, null);
  assert.equal(
    stored.rows[0].created_at.toISOString(),
    result.data.dashboard.asOf,
  );
  assert.equal(
    stored.rows[0].updated_at.toISOString(),
    result.data.dashboard.asOf,
  );
  assert.equal(stored.rows[0].date, result.data.dashboard.localDate);
  assert.equal(JSON.stringify(result).includes(other.user.id), false);
  assert.equal(JSON.stringify(result).includes(fixture.token), false);
});

test("title validation reaches PostgreSQL at code point bounds and returns safe title field feedback", async () => {
  const fixture = await owner();
  for (const title of ["a", "a".repeat(80), "🌱".repeat(80)]) {
    const result = await createHabitForSession(db, fixture.session, { title });
    assert.equal(result.ok, true);
    if (result.ok)
      assert.equal(result.data.dashboard.habits.at(-1)?.title, title);
  }
  for (const input of [
    null,
    {},
    { title: " " },
    { title: "a".repeat(81) },
    { title: "🌱".repeat(81) },
    { title: "Read\0books" },
    { title: "\u0085Read" },
    { title: "Read\u0085" },
    { title: "forged", userId: fixture.user.id },
  ]) {
    const result = await createHabitForSession(db, fixture.session, input);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "VALIDATION_ERROR");
      assert.ok(result.error.fieldErrors?.title?.length);
      assert.equal(result.error.correlationId, undefined);
      assert.equal(JSON.stringify(result).includes(fixture.user.id), false);
    }
  }
  assert.equal(
    (
      await pool.query(
        "select count(*)::int as n from habits where user_id=$1",
        [fixture.user.id],
      )
    ).rows[0].n,
    3,
  );
});

test("concurrent create requests serialize the ten-active cap and preserve creation order", async () => {
  const fixture = await owner();
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, n) =>
      createHabitForSession(db, fixture.session, { title: `Habit ${n}` }),
    ),
  );
  const successes = results.filter((result) => result.ok);
  assert.equal(successes.length, 10);
  assert.equal(
    results.filter(
      (result) => !result.ok && result.error.code === "LIMIT_REACHED",
    ).length,
    2,
  );
  assert.deepEqual(
    successes
      .map((result) => result.data.dashboard.habits.length)
      .sort((a, b) => a - b),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  );
  const stored = await pool.query(
    "select h.id,s.habit_id from habits h join habit_streaks s on s.habit_id=h.id and s.user_id=h.user_id where h.user_id=$1 order by h.created_at,h.id",
    [fixture.user.id],
  );
  assert.equal(stored.rowCount, 10);
  const current = await dashboardForSession(db, fixture.session);
  assert.equal(current.ok, true);
  if (current.ok)
    assert.deepEqual(
      current.data.habits.map((h) => h.id),
      stored.rows.map((row) => row.id),
    );
  const archived = await archiveHabitForSession(db, fixture.session, {
    habitId: stored.rows[0].id,
  });
  assert.equal(archived.ok, true);
  const replacement = await createHabitForSession(db, fixture.session, {
    title: "Replacement",
  });
  assert.equal(replacement.ok, true);
  if (replacement.ok)
    assert.equal(replacement.data.dashboard.habits.length, 10);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int as n from habits where user_id=$1",
        [fixture.user.id],
      )
    ).rows[0].n,
    11,
  );
});

test("archive is idempotent and keeps logs, streaks, totals, rewards and archive instant", async () => {
  const fixture = await owner();
  const created = await createHabitForSession(db, fixture.session, {
    title: "Read",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const habitId = created.data.habitId;
  await pool.query(
    "insert into habit_logs(habit_id,user_id,local_date,completed_at) select $1,$2,(clock_timestamp() at time zone 'UTC')::date-n,clock_timestamp() from generate_series(0,4) as n",
    [habitId, fixture.user.id],
  );
  await pool.query(
    "update habit_streaks set run_length=5,longest_streak=5,last_completed_on=(clock_timestamp() at time zone 'UTC')::date where habit_id=$1 and user_id=$2",
    [habitId, fixture.user.id],
  );
  await pool.query(
    "update garden_state set lifetime_completion_count=5 where user_id=$1",
    [fixture.user.id],
  );
  await pool.query(
    "insert into user_plants values($1,'daisy',clock_timestamp())",
    [fixture.user.id],
  );
  const before = await dashboardForSession(db, fixture.session);
  assert.equal(before.ok, true);
  const archived = await archiveHabitForSession(db, fixture.session, {
    habitId,
  });
  assert.equal(archived.ok, true);
  if (!archived.ok || !before.ok) return;
  assert.equal(archived.data.status, "archived");
  assert.deepEqual(archived.data.dashboard.habits, []);
  assert.equal(archived.data.dashboard.lifetimeCompletionCount, 5);
  assert.deepEqual(archived.data.dashboard.plants, before.data.plants);
  const first = await pool.query(
    "select archived_at,updated_at from habits where id=$1 and user_id=$2",
    [habitId, fixture.user.id],
  );
  assert.equal(
    first.rows[0].archived_at.toISOString(),
    archived.data.dashboard.asOf,
  );
  const replay = await archiveHabitForSession(db, fixture.session, { habitId });
  assert.equal(replay.ok, true);
  if (replay.ok) assert.equal(replay.data.status, "already_archived");
  const retained = await pool.query(
    "select h.archived_at,h.updated_at,s.run_length,s.longest_streak,(select count(*)::int from habit_logs where habit_id=h.id and user_id=h.user_id) as logs from habits h join habit_streaks s on s.habit_id=h.id and s.user_id=h.user_id where h.id=$1 and h.user_id=$2",
    [habitId, fixture.user.id],
  );
  assert.equal(
    retained.rows[0].archived_at.toISOString(),
    first.rows[0].archived_at.toISOString(),
  );
  assert.equal(
    retained.rows[0].updated_at.toISOString(),
    first.rows[0].updated_at.toISOString(),
  );
  assert.equal(retained.rows[0].logs, 5);
  assert.equal(retained.rows[0].run_length, 5);
  assert.equal(retained.rows[0].longest_streak, 5);
  const next = await createHabitForSession(db, fixture.session, {
    title: "Walk",
  });
  assert.equal(next.ok, true);
  if (next.ok) {
    assert.equal(next.data.dashboard.lifetimeCompletionCount, 5);
    assert.deepEqual(next.data.dashboard.plants, before.data.plants);
  }
});

test("foreign and absent resources are indistinguishable while malformed IDs get field feedback", async () => {
  const fixture = await owner();
  const other = await owner();
  const created = await createHabitForSession(db, other.session, {
    title: "Private",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const foreign = await archiveHabitForSession(db, fixture.session, {
    habitId: created.data.habitId,
  });
  const missing = await archiveHabitForSession(db, fixture.session, {
    habitId: randomUUID(),
  });
  assert.deepEqual(foreign, missing);
  assert.equal(foreign.ok, false);
  if (!foreign.ok) assert.equal(foreign.error.code, "NOT_FOUND");
  for (const input of [
    { habitId: "bad" },
    { habitId: created.data.habitId, userId: other.user.id },
  ]) {
    const invalid = await archiveHabitForSession(db, fixture.session, input);
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.error.code, "VALIDATION_ERROR");
      assert.ok(invalid.error.fieldErrors?.habitId?.length);
    }
  }
  assert.equal(
    (
      await pool.query(
        "select archived_at from habits where id=$1 and user_id=$2",
        [created.data.habitId, other.user.id],
      )
    ).rows[0].archived_at,
    null,
  );
});

test("missing and expired real sessions cannot create or archive and uninitialized users must onboard", async () => {
  const fixture = await owner();
  const created = await createHabitForSession(db, fixture.session, {
    title: "Keep",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const expired = await createSessionFixture(new Date(Date.now() - 60000));
  for (const session of [
    await resolveSession(),
    await resolveSession(expired.cookie),
    {
      user: { id: fixture.user.id },
      expires: new Date(Date.now() - 1000).toISOString(),
    },
  ]) {
    const create = await createHabitForSession(db, session, {
      title: "Denied",
    });
    const archive = await archiveHabitForSession(db, session, {
      habitId: created.data.habitId,
    });
    for (const result of [create, archive]) {
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error.code, "UNAUTHENTICATED");
    }
  }
  const newcomer = await owner(false);
  for (const result of [
    await createHabitForSession(db, newcomer.session, { title: "Wait" }),
    await archiveHabitForSession(db, newcomer.session, {
      habitId: created.data.habitId,
    }),
  ]) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "ONBOARDING_REQUIRED");
  }
  assert.equal(
    (
      await pool.query(
        "select count(*)::int as n from habits where user_id=$1 and archived_at is null",
        [fixture.user.id],
      )
    ).rows[0].n,
    1,
  );
});

test("failed streak insert rolls back its new habit and returns a redacted safe error", async () => {
  const fixture = await owner();
  const admin = await adminClient();
  try {
    await admin.query(
      `create function task6_reject_streak() returns trigger language plpgsql as $$ begin if new.user_id='${fixture.user.id}'::uuid then raise exception 'private injected SQL failure'; end if; return new; end $$`,
    );
    await admin.query(
      "create trigger task6_streak_failure before insert on habit_streaks for each row execute function task6_reject_streak()",
    );
    const result = await createHabitForSession(db, fixture.session, {
      title: "Rollback",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
      assert.match(result.error.correlationId!, /^[0-9a-f-]{36}$/);
      assert.equal(JSON.stringify(result).includes("private injected"), false);
    }
    assert.equal(
      (
        await pool.query(
          "select count(*)::int as n from habits where user_id=$1",
          [fixture.user.id],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await admin.query(
      "drop trigger if exists task6_streak_failure on habit_streaks",
    );
    await admin.query("drop function if exists task6_reject_streak()");
    await admin.end();
  }
});

test("archive waits on user before locking habit while another owner continues independently", async () => {
  const fixture = await owner();
  const other = await owner();
  const created = await createHabitForSession(db, fixture.session, {
    title: "Wait",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const blocker = await pool.connect();
  const observer = await adminClient();
  let pending: ReturnType<typeof archiveHabitForSession> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select id from users where id=$1 for update", [
      fixture.user.id,
    ]);
    pending = archiveHabitForSession(db, fixture.session, {
      habitId: created.data.habitId,
    });
    let waiting = false;
    for (let n = 0; n < 100; n++) {
      const activity = await observer.query(
        "select exists(select 1 from pg_stat_activity where application_name='task6-habits' and wait_event_type='Lock' and query like '%users%') as waiting",
      );
      if (activity.rows[0].waiting) {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(waiting, true, "Archive must wait at the user lock.");
    await observer.query("begin");
    await observer.query(
      "select id from habits where id=$1 and user_id=$2 for update nowait",
      [created.data.habitId, fixture.user.id],
    );
    await observer.query("rollback");
    const independent = await createHabitForSession(db, other.session, {
      title: "Independent",
    });
    assert.equal(independent.ok, true);
  } finally {
    await observer.query("rollback");
    await observer.end();
    await blocker.query("rollback");
    blocker.release();
    if (pending) assert.equal((await pending).ok, true);
  }
});

test("runtime role cannot delete an empty habit or retained history and rewards", async () => {
  const fixture = await owner();
  const created = await createHabitForSession(db, fixture.session, {
    title: "Retain",
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  for (const query of [
    "delete from habits where user_id=$1",
    "delete from habit_logs where user_id=$1",
    "delete from habit_streaks where user_id=$1",
    "delete from garden_state where user_id=$1",
    "delete from user_plants where user_id=$1",
  ]) {
    await assert.rejects(
      pool.query(query, [fixture.user.id]),
      (error: unknown) =>
        error instanceof Error && "code" in error && error.code === "42501",
    );
  }
  assert.equal((await dashboardForSession(db, fixture.session)).ok, true);
});
