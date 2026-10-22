import assert from "node:assert/strict";
import { test } from "node:test";

test("server-only database factory imports without credentials and connects lazily with DB-only config", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const module = await import("../../src/shared/server/db/client.ts");
    assert.throws(
      () => module.getDatabase(),
      /Database configuration is unavailable/,
    );
    process.env.DATABASE_URL = process.env.TEST_RUNTIME_DATABASE_URL;
    const db = module.getDatabase();
    try {
      assert.equal(module.getDatabase(), db);
      const result = await db.$client.query("select current_user as role");
      assert.equal(result.rows[0].role, "habit_garden_runtime");
    } finally {
      await db.$client.end();
    }
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
