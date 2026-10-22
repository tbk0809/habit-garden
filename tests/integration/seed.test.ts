import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";
import { seedFixtures } from "../../src/db/seed/fixtures.ts";

assertLocalDatabaseTarget(
  process.env.TEST_DATABASE_URL,
  process.env.NODE_ENV,
  "test",
);
const client = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL,
});
await client.connect();
after(() => client.end());

test("deterministic fictional fixtures repeat without changing any retained row", async () => {
  await seedFixtures(client);
  const before = await client.query(
    "select jsonb_agg(to_jsonb(u) order by id) as data from users u",
  );
  await seedFixtures(client);
  assert.deepEqual(
    (
      await client.query(
        "select jsonb_agg(to_jsonb(u) order by id) as data from users u",
      )
    ).rows,
    before.rows,
  );
  assert.deepEqual(
    (
      await client.query(
        "select g.lifetime_completion_count,count(l.*)::int as retained from garden_state g left join habit_logs l on l.user_id=g.user_id group by g.user_id order by g.user_id",
      )
    ).rows,
    [
      { lifetime_completion_count: 5, retained: 5 },
      { lifetime_completion_count: 0, retained: 0 },
    ],
  );
  assert.equal(
    (await client.query("select count(*)::int as count from users")).rows[0]
      .count,
    2,
  );
  assert.equal(
    (await client.query("select count(*)::int as count from sessions")).rows[0]
      .count,
    0,
  );
  assert.equal(
    (await client.query("select count(*)::int as count from oauth_accounts"))
      .rows[0].count,
    0,
  );
});

test("conflicting fixture key refuses without overwriting or partial inserts", async () => {
  await client.query(
    "update users set name='Existing user data' where email='mira@example.invalid'",
  );
  try {
    await assert.rejects(seedFixtures(client), /Fixture conflict/);
    assert.equal(
      (
        await client.query(
          "select name from users where email='mira@example.invalid'",
        )
      ).rows[0].name,
      "Existing user data",
    );
  } finally {
    await client.query(
      "update users set name='Mira Example' where email='mira@example.invalid'",
    );
  }
  // Early missing data must not remain inserted after a later fixture conflicts.
  await client.query(
    "delete from garden_state where user_id='30000000-0000-4000-8000-000000000001'",
  );
  await client.query(
    "insert into user_plants values('30000000-0000-4000-8000-000000000002','daisy','2026-01-01')",
  );
  await assert.rejects(seedFixtures(client), /Fixture conflict/);
  assert.equal(
    (
      await client.query(
        "select count(*)::int as count from garden_state where user_id='30000000-0000-4000-8000-000000000001'",
      )
    ).rows[0].count,
    0,
  );
});
