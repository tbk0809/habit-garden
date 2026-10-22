import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { Auth } from "@auth/core";
import * as schema from "../../src/db/schema/index.ts";
import { createAuthConfig } from "../../src/features/auth/config.ts";
import { confirmTimeZoneForSession } from "../../src/features/auth/onboarding.ts";
import { createSessionFixture } from "../helpers/session.ts";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";
import { dashboardForSession } from "../../src/features/dashboard/read.ts";

assertLocalDatabaseTarget(
  process.env.TEST_RUNTIME_DATABASE_URL,
  process.env.NODE_ENV,
  "test",
);
const pool = new pg.Pool({
  connectionString: process.env.TEST_RUNTIME_DATABASE_URL,
  max: 4,
});
const db = drizzle(pool, { schema });
const env = {
  DATABASE_URL: process.env.TEST_RUNTIME_DATABASE_URL!,
  AUTH_SECRET: "fictional-test-secret-with-at-least-32-characters",
  AUTH_GITHUB_ID: "fictional-client-id",
  AUTH_GITHUB_SECRET: "fictional-client-secret",
  AUTH_URL: "http://localhost:3000",
};
after(() => pool.end());
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

test("real Auth.js session response propagates persisted UUID without profile or token leakage", async () => {
  const fixture = await createSessionFixture();
  const resolved = await session(fixture.cookie);
  assert.deepEqual(resolved.user, { id: fixture.user.id });
  assert.deepEqual(Object.keys(resolved).sort(), ["expires", "user"]);
  const init = await confirmTimeZoneForSession(db, resolved, {
    timeZone: "Asia/Kuala_Lumpur",
  });
  assert.equal(init.ok, true);
  if (!init.ok) return;
  assert.equal(init.data.status, "initialized");
  assert.equal(init.data.dashboard.timeZone, "Asia/Kuala_Lumpur");
  assert.equal(init.data.dashboard.lifetimeCompletionCount, 0);
  assert.deepEqual(init.data.dashboard.habits, []);
  assert.deepEqual(init.data.dashboard.plants, [
    {
      plantId: "clover",
      name: "Clover",
      slotIndex: 0,
      unlockAt: 0,
      unlocked: true,
      growthPoints: 0,
      stage: "sprout",
      stageIndex: 0,
    },
    {
      plantId: "daisy",
      name: "Daisy",
      slotIndex: 1,
      unlockAt: 5,
      unlocked: false,
    },
    {
      plantId: "sunflower",
      name: "Sunflower",
      slotIndex: 2,
      unlockAt: 15,
      unlocked: false,
    },
    {
      plantId: "cherry",
      name: "Cherry",
      slotIndex: 3,
      unlockAt: 30,
      unlocked: false,
    },
  ]);
  const stored = await pool.query(
    "select time_zone,initialized_at,(select count(*)::int from garden_state where user_id=$1) as gardens,(select count(*)::int from user_plants where user_id=$1) as plants from users where id=$1",
    [fixture.user.id],
  );
  assert.equal(stored.rows[0].time_zone, "Asia/Kuala_Lumpur");
  assert.equal(
    stored.rows[0].initialized_at.toISOString(),
    init.data.dashboard.asOf,
  );
  assert.equal(stored.rows[0].gardens, 1);
  assert.equal(stored.rows[0].plants, 1);
});

test("absent or expired database sessions cannot initialize any user", async () => {
  const expired = await createSessionFixture(new Date(Date.now() - 60000));
  for (const cookie of [
    undefined,
    expired.cookie,
    "authjs.session-token=unknown",
  ]) {
    const result = await confirmTimeZoneForSession(db, await session(cookie), {
      timeZone: "UTC",
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "UNAUTHENTICATED");
  }
  const row = await pool.query("select time_zone from users where id=$1", [
    expired.user.id,
  ]);
  assert.equal(row.rows[0].time_zone, null);
  assert.equal(
    (
      await pool.query(
        "select count(*)::int as count from sessions where session_token=$1",
        [expired.token],
      )
    ).rows[0].count,
    0,
  );
});

test("same-zone concurrent submissions initialize once and return coherent replay without resetting existing history", async () => {
  const fixture = await createSessionFixture();
  const resolved = await session(fixture.cookie);
  const results = await Promise.all([
    confirmTimeZoneForSession(db, resolved, { timeZone: "UTC" }),
    confirmTimeZoneForSession(db, resolved, { timeZone: "UTC" }),
  ]);
  assert.deepEqual(results.map((r) => r.ok && r.data.status).sort(), [
    "already_initialized",
    "initialized",
  ]);
  const habit = randomUUID();
  const other = await createSessionFixture();
  await pool.query(
    "insert into habits(id,user_id,title,created_at,updated_at) values($1,$2,'Read',clock_timestamp(),clock_timestamp()),($3,$4,'Private',clock_timestamp(),clock_timestamp())",
    [habit, fixture.user.id, randomUUID(), other.user.id],
  );
  await pool.query(
    "insert into habit_streaks(habit_id,user_id,run_length,longest_streak,last_completed_on) values($1,$2,1,1,(clock_timestamp() at time zone 'UTC')::date)",
    [habit, fixture.user.id],
  );
  await pool.query(
    "insert into habit_logs(habit_id,user_id,local_date,completed_at) values($1,$2,(clock_timestamp() at time zone 'UTC')::date,clock_timestamp())",
    [habit, fixture.user.id],
  );
  await pool.query(
    "update garden_state set lifetime_completion_count=1 where user_id=$1",
    [fixture.user.id],
  );
  const replay = await confirmTimeZoneForSession(db, resolved, {
    timeZone: "UTC",
  });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.data.status, "already_initialized");
  assert.equal(replay.data.dashboard.lifetimeCompletionCount, 1);
  assert.deepEqual(replay.data.dashboard.habits, [
    {
      id: habit,
      title: "Read",
      completedToday: true,
      currentStreak: 1,
      bestStreak: 1,
    },
  ]);
  assert.equal(
    replay.data.dashboard.plants[0]?.unlocked &&
      replay.data.dashboard.plants[0].growthPoints,
    1,
  );
});

test("competing different zones serialize, keeping the winning zone immutable", async () => {
  const fixture = await createSessionFixture();
  const resolved = await session(fixture.cookie);
  const results = await Promise.all([
    confirmTimeZoneForSession(db, resolved, { timeZone: "UTC" }),
    confirmTimeZoneForSession(db, resolved, { timeZone: "Asia/Tokyo" }),
  ]);
  assert.equal(results.filter((r) => r.ok).length, 1);
  assert.equal(
    results.filter((r) => !r.ok && r.error.code === "TIME_ZONE_FIXED").length,
    1,
  );
  assert.equal(
    (
      await pool.query(
        "select count(*)::int as count from user_plants where user_id=$1",
        [fixture.user.id],
      )
    ).rows[0].count,
    1,
  );
});

test("strict boundary validation refuses malformed zone or extra owner authority with no writes", async () => {
  const fixture = await createSessionFixture();
  const resolved = await session(fixture.cookie);
  for (const input of [
    { timeZone: "Mars/Olympus" },
    { timeZone: "+08:00" },
    { timeZone: "UTC", userId: fixture.user.id },
    null,
  ]) {
    const result = await confirmTimeZoneForSession(db, resolved, input);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.code, "VALIDATION_ERROR");
  }
  assert.equal(
    (
      await pool.query("select time_zone from users where id=$1", [
        fixture.user.id,
      ])
    ).rows[0].time_zone,
    null,
  );
});

test("initialized user missing garden fails safely without repair or reward reset", async () => {
  const fixture = await createSessionFixture();
  const resolved = await session(fixture.cookie);
  await pool.query(
    "update users set time_zone='UTC',initialized_at=clock_timestamp() where id=$1",
    [fixture.user.id],
  );
  const result = await confirmTimeZoneForSession(db, resolved, {
    timeZone: "UTC",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
    assert.match(result.error.correlationId!, /^[0-9a-f-]{36}$/);
  }
  assert.equal(
    (
      await pool.query(
        "select count(*)::int as count from garden_state where user_id=$1",
        [fixture.user.id],
      )
    ).rows[0].count,
    0,
  );
});

test("dashboard requires onboarding and never exposes an archived or foreign-owned habit", async () => {
  const fixture = await createSessionFixture();
  const resolved = await session(fixture.cookie);
  const first = await dashboardForSession(db, resolved);
  assert.equal(first.ok, false);
  if (!first.ok) assert.equal(first.error.code, "ONBOARDING_REQUIRED");
  assert.equal(
    (await confirmTimeZoneForSession(db, resolved, { timeZone: "UTC" })).ok,
    true,
  );
  await pool.query(
    "insert into habits(id,user_id,title,created_at,updated_at,archived_at) values($1,$2,'Archived',clock_timestamp(),clock_timestamp(),clock_timestamp())",
    [randomUUID(), fixture.user.id],
  );
  const dashboard = await dashboardForSession(db, resolved);
  assert.equal(dashboard.ok, true);
  if (dashboard.ok) {
    assert.deepEqual(dashboard.data.habits, []);
    assert.match(dashboard.data.localDate, /^\d{4}-\d{2}-\d{2}$/);
    const day = await pool.query(
      "select ( $1::timestamptz at time zone 'UTC')::date::text as date",
      [dashboard.data.asOf],
    );
    assert.equal(dashboard.data.localDate, day.rows[0].date);
  }
});

test("missing catalog makes initialization roll back timezone, garden and starter atomically", async () => {
  const fixture = await createSessionFixture();
  const resolved = await session(fixture.cookie);
  assertLocalDatabaseTarget(
    process.env.TEST_DATABASE_URL,
    process.env.NODE_ENV,
    "test",
  );
  const admin = new pg.Client({
    connectionString: process.env.TEST_DATABASE_URL,
  });
  await admin.connect();
  const rollback = new Error("intentional test rollback");
  try {
    await assert.rejects(
      drizzle(admin, { schema }).transaction(async (tx) => {
        await tx
          .delete(schema.plantCatalog)
          .where(
            (await import("drizzle-orm")).eq(schema.plantCatalog.id, "cherry"),
          );
        const result = await confirmTimeZoneForSession(tx, resolved, {
          timeZone: "UTC",
        });
        assert.equal(result.ok, false);
        if (!result.ok) assert.equal(result.error.code, "SERVICE_UNAVAILABLE");
        const user = await tx
          .select()
          .from(schema.users)
          .where(
            (await import("drizzle-orm")).eq(schema.users.id, fixture.user.id),
          );
        assert.equal(user[0]?.timeZone, null);
        assert.equal(
          (
            await tx.execute(
              (await import("drizzle-orm"))
                .sql`select count(*)::int as count from garden_state where user_id=${fixture.user.id}`,
            )
          ).rows[0]?.count,
          0,
        );
        throw rollback;
      }),
      (error) => error === rollback,
    );
  } finally {
    await admin.end();
  }
  assert.equal(
    (await pool.query("select count(*)::int as count from plant_catalog"))
      .rows[0].count,
    4,
  );
});

test("Auth.js refuses missing CSRF and revokes a normal database session on valid sign-out", async () => {
  const fixture = await createSessionFixture();
  const errors: string[] = [];
  const previous = console.error;
  console.error = (...values) => {
    errors.push(values.join(" "));
  };
  try {
    const denied = await Auth(
      new Request("http://localhost:3000/api/auth/signout", {
        method: "POST",
        headers: {
          cookie: fixture.cookie,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "callbackUrl=/",
      }),
      createAuthConfig(db, env),
    );
    assert.equal(denied.status, 302);
    assert.equal(
      (
        await pool.query(
          "select count(*)::int as count from sessions where session_token=$1",
          [fixture.token],
        )
      ).rows[0].count,
      1,
    );
    assert.ok(errors.length > 0);
    assert.equal(errors.join(" ").includes(fixture.token), false);
    const csrf = await Auth(
      new Request("http://localhost:3000/api/auth/csrf"),
      createAuthConfig(db, env),
    );
    const token = (await csrf.json()).csrfToken;
    const cookie = csrf.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const signedOut = await Auth(
      new Request("http://localhost:3000/api/auth/signout", {
        method: "POST",
        headers: {
          cookie: `${fixture.cookie}; ${cookie}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          csrfToken: token,
          callbackUrl: "https://evil.example/steal",
        }),
      }),
      createAuthConfig(db, env),
    );
    assert.equal(signedOut.status, 302);
    assert.equal(signedOut.headers.get("location"), "http://localhost:3000");
    assert.equal(
      (
        await pool.query(
          "select count(*)::int as count from sessions where session_token=$1",
          [fixture.token],
        )
      ).rows[0].count,
      0,
    );
    assert.equal(await session(fixture.cookie), null);
  } finally {
    console.error = previous;
  }
});

test("GitHub authorization requests only profile scope and keeps state/PKCE cookies httpOnly sameSite", async () => {
  const csrf = await Auth(
    new Request("http://localhost:3000/api/auth/csrf"),
    createAuthConfig(db, env),
  );
  const token = (await csrf.json()).csrfToken;
  const cookie = csrf.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const response = await Auth(
    new Request("http://localhost:3000/api/auth/signin/github", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        csrfToken: token,
        callbackUrl: "/dashboard",
      }),
    }),
    createAuthConfig(db, env),
  );
  assert.equal(response.status, 302);
  const destination = new URL(response.headers.get("location")!);
  assert.equal(destination.origin, "https://github.com");
  assert.equal(destination.searchParams.get("scope"), "read:user");
  assert.equal(
    destination.searchParams.get("redirect_uri"),
    "http://localhost:3000/api/auth/callback/github",
  );
  assert.ok(destination.searchParams.get("state"));
  assert.ok(destination.searchParams.get("code_challenge"));
  for (const name of ["authjs.state", "authjs.pkce.code_verifier"]) {
    const stored = response.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${name}=`));
    assert.ok(stored);
    assert.match(stored, /HttpOnly/);
    assert.match(stored, /SameSite=Lax/);
  }
});
