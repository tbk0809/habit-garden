import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { Auth } from "@auth/core";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema/index.ts";
import { createAuthConfig } from "../../src/features/auth/config.ts";
import { confirmTimeZoneForSession } from "../../src/features/auth/onboarding.ts";
import { createHabitForSession } from "../../src/features/habits/service.ts";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";
import { createSessionFixture } from "./session.ts";

export async function completionHarness() {
  for (const url of [
    process.env.TEST_DATABASE_URL,
    process.env.TEST_RUNTIME_DATABASE_URL,
  ])
    assertLocalDatabaseTarget(url, process.env.NODE_ENV, "test");
  const admin = new pg.Client({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  const pool = new pg.Pool({
    connectionString: process.env.TEST_RUNTIME_DATABASE_URL,
    max: 4,
  });
  await admin.connect();
  assert.deepEqual(
    (await admin.query("select current_database() as db,current_user as role"))
      .rows,
    [{ db: "habit_garden_test", role: "habit_garden_migrator" }],
  );
  const ns = `t7_${randomUUID().replaceAll("-", "")}`;
  const db = drizzle(pool, { schema });
  const clients: pg.Client[] = [];
  const triggers: { name: string; table: string }[] = [];
  const env = {
    DATABASE_URL: process.env.TEST_RUNTIME_DATABASE_URL!,
    AUTH_SECRET: "fictional-test-secret-with-at-least-32-characters",
    AUTH_GITHUB_ID: "fictional-client-id",
    AUTH_GITHUB_SECRET: "fictional-client-secret",
    AUTH_URL: "http://localhost:3000",
  };
  await admin.query(
    `create schema ${ns}; create table ${ns}.clocks(pid integer primary key, instant timestamptz not null, gate bigint)`,
  );
  await admin.query(
    `create function ${ns}.clock_timestamp() returns timestamptz language plpgsql volatile as $$ declare stamp timestamptz; barrier bigint; begin select instant,gate into strict stamp,barrier from ${ns}.clocks where pid in (pg_backend_pid(),0) order by (pid=pg_backend_pid()) desc limit 1; raise notice 't7_clock:%:%',pg_backend_pid(),current_query(); if barrier is not null then perform pg_advisory_xact_lock(barrier); end if; return stamp; end $$`,
  );
  await admin.query(
    `revoke all on function ${ns}.clock_timestamp() from public; grant usage on schema ${ns} to habit_garden_runtime; grant select on ${ns}.clocks to habit_garden_runtime; grant execute on function ${ns}.clock_timestamp() to habit_garden_runtime`,
  );

  async function session(cookie?: string) {
    const response = await Auth(
      new Request("http://localhost:3000/api/auth/session", {
        headers: cookie ? { cookie } : {},
      }),
      createAuthConfig(db, env),
    );
    assert.equal(response.status, 200);
    return response.json();
  }
  async function owner(timeZone = "UTC") {
    const fixture = await createSessionFixture();
    const resolved = await session(fixture.cookie);
    assert.equal(
      (await confirmTimeZoneForSession(db, resolved, { timeZone })).ok,
      true,
    );
    const created = await createHabitForSession(db, resolved, {
      title: "Read",
    });
    assert.equal(created.ok, true);
    if (!created.ok) throw new Error("Fixture failed");
    return {
      ...fixture,
      session: resolved,
      habitId: created.data.habitId,
      date: created.data.dashboard.localDate,
    };
  }
  async function scoped(instant: string, gate: number | null = null) {
    const client = new pg.Client({
      connectionString: process.env.TEST_RUNTIME_DATABASE_URL,
      options: `-c search_path=${ns},pg_catalog,public -c statement_timeout=12000`,
    });
    await client.connect();
    clients.push(client);
    assert.equal(
      (await client.query("select current_user as role")).rows[0].role,
      "habit_garden_runtime",
    );
    const pid = Number(
      (await client.query("select pg_backend_pid() as pid")).rows[0].pid,
    );
    const notices: string[] = [];
    client.on("notice", (notice) => {
      const message = notice.message ?? "";
      if (
        message.startsWith("t7_clock:") ||
        message === "t7_commit_four_states"
      )
        notices.push(message);
    });
    await admin.query(`insert into ${ns}.clocks values($1,$2,null)`, [
      pid,
      instant,
    ]);
    assert.equal(
      (
        await client.query("select clock_timestamp() as probe")
      ).rows[0].probe.toISOString(),
      new Date(instant).toISOString(),
      "Scoped clock interception must be active",
    );
    assert.equal(notices.length, 1);
    notices.length = 0;
    await setClock(pid, instant, gate);
    return { client, pid, notices, db: drizzle(client, { schema }) };
  }
  async function setClock(
    pid: number,
    instant: string,
    gate: number | null = null,
  ) {
    await admin.query(
      `update ${ns}.clocks set instant=$2,gate=$3 where pid=$1`,
      [pid, instant, gate],
    );
  }
  async function blocked(pid: number, blockerPid?: number) {
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const result = await pool.query(
        "select query,pg_blocking_pids(pid) as blockers from pg_stat_activity where pid=$1",
        [pid],
      );
      const row = result.rows[0];
      if (
        row?.blockers.length &&
        (blockerPid === undefined || row.blockers.includes(blockerPid))
      )
        return String(row.query);
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    assert.fail(
      `Backend ${pid} never reached the expected PostgreSQL blocking barrier`,
    );
  }
  async function gateTrigger(
    table: "habit_logs" | "habits",
    userId: string,
    gate: number,
  ) {
    const name = `${ns}_${triggers.length}`;
    await admin.query(
      `create function ${ns}.${name}() returns trigger language plpgsql as $$ begin if new.user_id='${userId}'::uuid then perform pg_advisory_xact_lock(${gate}); end if; return new; end $$`,
    );
    await admin.query(
      `create trigger ${name} before ${table === "habits" ? "update" : "insert"} on ${table} for each row execute function ${ns}.${name}()`,
    );
    triggers.push({ name, table });
  }
  async function stored(userId: string) {
    const result = await pool.query(
      "select (select coalesce(jsonb_agg(to_jsonb(l) order by habit_id,local_date),'[]') from habit_logs l where user_id=$1) as logs,(select coalesce(jsonb_agg(to_jsonb(s) order by habit_id),'[]') from habit_streaks s where user_id=$1) as streaks,(select to_jsonb(g) from garden_state g where user_id=$1) as garden,(select jsonb_agg(to_jsonb(p) order by plant_id) from user_plants p where user_id=$1) as plants",
      [userId],
    );
    return result.rows[0];
  }
  async function seedRun(
    userId: string,
    habitId: string,
    total: number,
    last: string,
  ) {
    await admin.query(
      "insert into habit_logs(habit_id,user_id,local_date,completed_at) select $1,$2,$3::date-n,($3::date-n)::timestamptz from generate_series(0,$4::int-1) as n",
      [habitId, userId, last, total],
    );
    await admin.query(
      "update habit_streaks set run_length=$3,longest_streak=$3,last_completed_on=$4 where habit_id=$1 and user_id=$2",
      [habitId, userId, total, last],
    );
    await admin.query(
      "update garden_state set lifetime_completion_count=$2 where user_id=$1",
      [userId, total],
    );
    await admin.query(
      "insert into user_plants select $1,id,clock_timestamp() from plant_catalog where unlock_at>0 and unlock_at<=$2",
      [userId, total],
    );
  }
  async function close() {
    await admin.query("rollback");
    await admin.query("select pg_advisory_unlock_all()");
    for (const client of clients) {
      await client.query("rollback");
      await client.end();
    }
    for (const { name, table } of triggers)
      await admin.query(`drop trigger if exists ${name} on ${table}`);
    await admin.query(`drop schema ${ns} cascade`);
    await pool.end();
    await admin.end();
  }
  return {
    admin,
    pool,
    db,
    ns,
    session,
    owner,
    scoped,
    setClock,
    blocked,
    gateTrigger,
    stored,
    seedRun,
    close,
  };
}
