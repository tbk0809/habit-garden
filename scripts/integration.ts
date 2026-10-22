import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { assertLocalDatabaseTarget } from "../src/shared/server/db/local-target.ts";
import { migrateDatabase } from "../src/shared/server/db/migrate.ts";

// Destructive cleanup exists only in the test runner, after exact target checks.
try {
  const testEnvironment = process.env.NODE_ENV ?? "test";
  const url = process.env.TEST_DATABASE_URL;
  assertLocalDatabaseTarget(url, testEnvironment, "test");
  assertLocalDatabaseTarget(
    process.env.TEST_RUNTIME_DATABASE_URL,
    testEnvironment,
    "test",
  );
  const runtime = new URL(process.env.TEST_RUNTIME_DATABASE_URL!);
  const admin = new URL(url);
  if (
    runtime.host !== admin.host ||
    runtime.username !== "habit_garden_runtime" ||
    admin.username !== "habit_garden_migrator"
  )
    throw new Error("Test roles/targets refused.");
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    const actual = await client.query(
      "select current_database() as database,current_user as owner",
    );
    assert.deepEqual(actual.rows, [
      { database: "habit_garden_test", owner: "habit_garden_migrator" },
    ]);
    await client.query("drop schema if exists public cascade");
    await client.query("drop schema if exists drizzle cascade");
    await client.query("create schema public");
    await client.query("revoke create on schema public from public");
  } finally {
    await client.end();
  }
  assert.equal(
    await migrateDatabase(url),
    1,
    "Empty DB must apply the reviewed initial migration",
  );
  assert.equal(await migrateDatabase(url), 0, "Repeat must be a no-op");
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "--test",
      "--test-concurrency=1",
      "tests/integration/*.test.ts",
    ],
    { stdio: "inherit", env: { ...process.env, NODE_ENV: testEnvironment } },
  );
  process.exitCode = result.status ?? 1;
} catch {
  console.error(
    "Isolated PostgreSQL integration failed. Verify test environment, exact loopback target and database roles.",
  );
  process.exitCode = 1;
}
