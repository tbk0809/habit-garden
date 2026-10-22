import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL,
});
await client.connect();
after(() => client.end());

test("reviewed migration installs the nine application tables and fixed catalog", async () => {
  const tables = await client.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  );
  assert.deepEqual(
    tables.rows.map((row) => row.tablename),
    [
      "garden_state",
      "habit_logs",
      "habit_streaks",
      "habits",
      "oauth_accounts",
      "plant_catalog",
      "sessions",
      "user_plants",
      "users",
    ],
  );
  const catalog = await client.query(
    "select * from plant_catalog order by slot_index",
  );
  assert.deepEqual(catalog.rows, [
    { id: "clover", slot_index: 0, unlock_at: 0 },
    { id: "daisy", slot_index: 1, unlock_at: 5 },
    { id: "sunflower", slot_index: 2, unlock_at: 15 },
    { id: "cherry", slot_index: 3, unlock_at: 30 },
  ]);
});

const alice = "10000000-0000-4000-8000-000000000001";
const bob = "10000000-0000-4000-8000-000000000002";
const habit = "20000000-0000-4000-8000-000000000001";
const instant = "2026-01-01T12:00:00Z";

async function rolledBack(body: () => Promise<void>) {
  await client.query("begin");
  try {
    await body();
  } finally {
    await client.query("rollback");
  }
}

async function rejectsSql(sql: string, values: unknown[], code: string) {
  await client.query("savepoint expected_failure");
  await assert.rejects(client.query(sql, values), { code });
  await client.query("rollback to savepoint expected_failure");
}

async function ownersAndHabit() {
  await client.query("insert into users(id) values($1),($2)", [alice, bob]);
  await client.query(
    "insert into habits(id,user_id,title,created_at,updated_at) values($1,$2,'Read',$3,$3)",
    [habit, alice, instant],
  );
}

test("ownership keys reject a foreign user's log and streak, and daily logs are unique", () =>
  rolledBack(async () => {
    await ownersAndHabit();
    await rejectsSql(
      "insert into habit_logs values($1,$2,'2026-01-01',$3)",
      [habit, bob, instant],
      "23503",
    );
    await rejectsSql(
      "insert into habit_streaks(habit_id,user_id) values($1,$2)",
      [habit, bob],
      "23503",
    );
    await client.query("insert into habit_logs values($1,$2,'2026-01-01',$3)", [
      habit,
      alice,
      instant,
    ]);
    await rejectsSql(
      "insert into habit_logs values($1,$2,'2026-01-01',$3)",
      [habit, alice, instant],
      "23505",
    );
  }));

test("checks reject malformed titles, archive dates, streaks, catalog and totals", () =>
  rolledBack(async () => {
    await ownersAndHabit();
    for (const title of ["", " ", " Read", "Read ", "\tRead"]) {
      await rejectsSql(
        "update habits set title=$1 where id=$2",
        [title, habit],
        "23514",
      );
    }
    await rejectsSql(
      "update habits set title=$1 where id=$2",
      ["x".repeat(81), habit],
      "22001",
    );
    await rejectsSql(
      "update habits set archived_at='2025-12-31' where id=$1",
      [habit],
      "23514",
    );
    await rejectsSql(
      "insert into habit_streaks(habit_id,user_id,run_length,longest_streak) values($1,$2,1,1)",
      [habit, alice],
      "23514",
    );
    await rejectsSql(
      "insert into habit_streaks(habit_id,user_id,run_length,longest_streak,last_completed_on) values($1,$2,2,1,'2026-01-01')",
      [habit, alice],
      "23514",
    );
    await rejectsSql(
      "insert into garden_state values($1,-1,$2)",
      [alice, instant],
      "23514",
    );
    await rejectsSql(
      "insert into plant_catalog values('rose',4,50)",
      [],
      "23514",
    );
    await rejectsSql(
      "update users set time_zone='UTC' where id=$1",
      [alice],
      "23514",
    );
    await rejectsSql(
      "insert into oauth_accounts(user_id,type,provider,provider_account_id) values($1,'oauth','other','1')",
      [alice],
      "23514",
    );
  }));

test("history, timezone confirmation and archive remain immutable even to the owner role", () =>
  rolledBack(async () => {
    await ownersAndHabit();
    await client.query(
      "update users set time_zone='Asia/Kuala_Lumpur', initialized_at=$2 where id=$1",
      [alice, instant],
    );
    await client.query("update habits set archived_at=$2 where id=$1", [
      habit,
      instant,
    ]);
    await client.query("insert into habit_logs values($1,$2,'2026-01-01',$3)", [
      habit,
      alice,
      instant,
    ]);
    await client.query("insert into user_plants values($1,'clover',$2)", [
      alice,
      instant,
    ]);
    for (const sql of [
      "update users set time_zone='UTC'",
      "update users set time_zone=null,initialized_at=null",
      "update users set initialized_at=initialized_at+interval '1 second'",
      "update habits set archived_at=null",
      "update habit_logs set local_date='2026-01-02'",
      "delete from habit_logs",
      "update user_plants set unlocked_at=unlocked_at+interval '1 second'",
      "delete from user_plants",
    ])
      await rejectsSql(sql, [], "23514");
    await rejectsSql("delete from users where id=$1", [alice], "23503");
  }));

test("runtime role permits adapter operations but cannot change catalog, histories or delete domain rows", () =>
  rolledBack(async () => {
    await ownersAndHabit();
    await client.query("set local role habit_garden_runtime");
    await client.query(
      "update users set time_zone='UTC',initialized_at=$2 where id=$1",
      [alice, instant],
    );
    await rejectsSql(
      "update users set time_zone='Asia/Kuala_Lumpur' where id=$1",
      [alice],
      "23514",
    );
    await client.query(
      "insert into sessions values('temporary-session',$1,$2)",
      [alice, instant],
    );
    await client.query(
      "update sessions set expires_at='2027-01-01' where session_token='temporary-session'",
    );
    await client.query(
      "delete from sessions where session_token='temporary-session'",
    );
    await client.query(
      "insert into oauth_accounts(user_id,type,provider,provider_account_id) values($1,'oauth','github','temporary')",
      [alice],
    );
    await client.query(
      "update oauth_accounts set scope='read:user' where provider_account_id='temporary'",
    );
    await client.query(
      "delete from oauth_accounts where provider_account_id='temporary'",
    );
    for (const sql of [
      "delete from habits",
      "delete from users",
      "delete from garden_state",
      "update habit_logs set completed_at=now()",
      "delete from habit_logs",
      "truncate habit_logs",
      "update user_plants set unlocked_at=now()",
      "delete from user_plants",
      "insert into plant_catalog values('rose',4,50)",
      "create table forbidden(id int)",
      "select * from drizzle.__drizzle_migrations",
    ]) {
      await rejectsSql(sql, [], "42501");
    }
  }));
