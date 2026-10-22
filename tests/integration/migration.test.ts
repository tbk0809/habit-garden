import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";
import {
  migrateDatabase,
  MIGRATION_LOCK,
} from "../../src/shared/server/db/migrate.ts";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";

const url = process.env.TEST_DATABASE_URL;
assertLocalDatabaseTarget(url, process.env.NODE_ENV, "test");
const client = new pg.Client({ connectionString: url });
await client.connect();
after(() => client.end());

test("migration journal repeats as a no-op preserving catalog and migration hashes", async () => {
  const before = await client.query(
    "select * from drizzle.__drizzle_migrations order by id",
  );
  assert.equal(before.rowCount, 1);
  assert.equal(await migrateDatabase(url), 0);
  assert.equal(await migrateDatabase(url), 0);
  assert.deepEqual(
    (
      await client.query(
        "select * from drizzle.__drizzle_migrations order by id",
      )
    ).rows,
    before.rows,
  );
});

test("migration runner waits for the dedicated session advisory lock", async () => {
  await client.query("select pg_advisory_lock($1::int,$2::int)", [
    ...MIGRATION_LOCK,
  ]);
  let settled = false;
  const pending = migrateDatabase(url).finally(() => {
    settled = true;
  });
  try {
    // Observe PostgreSQL's actual waiting lock, not a guessed scheduler delay.
    const deadline = Date.now() + 5000;
    let waiting = false;
    while (!waiting && Date.now() < deadline) {
      const locks = await client.query(
        "select exists(select 1 from pg_locks where locktype='advisory' and classid=$1 and objid=$2 and not granted) as waiting",
        [...MIGRATION_LOCK],
      );
      waiting = locks.rows[0].waiting;
      if (!waiting) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(waiting, true);
    assert.equal(settled, false);
  } finally {
    await client.query("select pg_advisory_unlock($1::int,$2::int)", [
      ...MIGRATION_LOCK,
    ]);
  }
  assert.equal(await pending, 0);
});
