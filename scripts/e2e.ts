import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { assertLocalDatabaseTarget } from "../src/shared/server/db/local-target.ts";

// Reuse integration.ts for the guarded migration/reset. Browser acceptance only
// verifies that target and adds isolated sessions/users; it never resets data.
try {
  assert.equal(process.versions.node, "24.22.1");
  const environment = process.env.NODE_ENV ?? "test";
  assertLocalDatabaseTarget(process.env.TEST_DATABASE_URL, environment, "test");
  assertLocalDatabaseTarget(
    process.env.TEST_RUNTIME_DATABASE_URL,
    environment,
    "test",
  );
  const admin = new URL(process.env.TEST_DATABASE_URL!);
  const runtime = new URL(process.env.TEST_RUNTIME_DATABASE_URL!);
  assert.equal(admin.host, runtime.host);
  assert.equal(admin.username, "habit_garden_migrator");
  assert.equal(runtime.username, "habit_garden_runtime");
  assert.ok((await readFile(".next/BUILD_ID", "utf8")).trim());
  for (const [connectionString, role] of [
    [process.env.TEST_DATABASE_URL!, "habit_garden_migrator"],
    [process.env.TEST_RUNTIME_DATABASE_URL!, "habit_garden_runtime"],
  ]) {
    const client = new pg.Client({
      connectionString,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    try {
      assert.deepEqual(
        (
          await client.query(
            "select current_database() as db,current_user as role",
          )
        ).rows,
        [{ db: "habit_garden_test", role }],
      );
      assert.equal(
        Number(
          (await client.query("select count(*) as count from plant_catalog"))
            .rows[0].count,
        ),
        4,
      );
    } finally {
      await client.end();
    }
  }
  const result = spawnSync(
    process.execPath,
    [
      "--conditions=react-server",
      "node_modules/@playwright/test/cli.js",
      "test",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, NODE_ENV: "test", PLAYWRIGHT_NO_COPY_PROMPT: "1" },
    },
  );
  process.exitCode = result.status ?? 1;
} catch {
  console.error(
    "Browser acceptance refused or failed. Require Node24.22.1, a built app, and the migrated exact loopback disposable test database with both test roles.",
  );
  process.exitCode = 1;
}
