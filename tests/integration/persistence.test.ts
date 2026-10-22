import assert from "node:assert/strict";
import { after, test } from "node:test";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { adapterTables, users } from "../../src/db/schema/index.ts";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";

assertLocalDatabaseTarget(
  process.env.TEST_RUNTIME_DATABASE_URL,
  process.env.NODE_ENV,
  "test",
);
const client = new pg.Client({
  connectionString: process.env.TEST_RUNTIME_DATABASE_URL,
});
await client.connect();
after(() => client.end());

test("stock adapter creates UUID user with DB created_at default and maps account/session columns", async () => {
  await client.query("begin");
  try {
    const db = drizzle(client);
    const adapter = DrizzleAdapter(db, adapterTables);
    const before = Date.now();
    // Adapter's public TS signature requires an id, but hasDefault must discard
    // this sentinel and use our runtime cryptographic UUID default.
    const user = await adapter.createUser!({
      id: "must-be-discarded",
      name: "Adapter fixture",
      email: "adapter@example.invalid",
      emailVerified: null,
      image: null,
    });
    assert.match(
      user.id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    const [stored] = await db.select().from(users).where(eq(users.id, user.id));
    assert.ok(stored);
    assert.ok(stored.createdAt instanceof Date);
    assert.ok(Math.abs(stored.createdAt.getTime() - before) < 5000);
    assert.equal(stored.timeZone, null);
    await adapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "github",
      providerAccountId: "adapter-test",
      scope: "read:user",
    });
    assert.equal(
      (
        await adapter.getUserByAccount!({
          provider: "github",
          providerAccountId: "adapter-test",
        })
      )?.id,
      user.id,
    );
    const expires = new Date("2027-01-01T00:00:00Z");
    await adapter.createSession!({
      userId: user.id,
      sessionToken: "adapter-test-session",
      expires,
    });
    const session = await adapter.getSessionAndUser!("adapter-test-session");
    assert.equal(session?.user.id, user.id);
    assert.equal(session?.session.expires.toISOString(), expires.toISOString());
    assert.equal(session?.session.sessionToken, "adapter-test-session");
    await adapter.updateSession!({
      sessionToken: "adapter-test-session",
      expires: new Date("2027-02-01T00:00:00Z"),
    });
    assert.equal(
      (
        await adapter.getSessionAndUser!("adapter-test-session")
      )?.session.expires.toISOString(),
      "2027-02-01T00:00:00.000Z",
    );
    await adapter.deleteSession!("adapter-test-session");
    assert.equal(
      await adapter.getSessionAndUser!("adapter-test-session"),
      null,
    );
    await adapter.unlinkAccount!({
      provider: "github",
      providerAccountId: "adapter-test",
    });
    assert.equal(
      await adapter.getUserByAccount!({
        provider: "github",
        providerAccountId: "adapter-test",
      }),
      null,
    );
  } finally {
    await client.query("rollback");
  }
});

test("civil dates stay strings while timestamp columns preserve instants", async () => {
  await client.query("begin");
  try {
    const user = "90000000-0000-4000-8000-000000000001";
    const habit = "90000000-0000-4000-8000-000000000002";
    await client.query("insert into users(id) values($1)", [user]);
    await client.query(
      "insert into habits(id,user_id,title,created_at,updated_at) values($1,$2,'Read','2026-01-01','2026-01-01')",
      [habit, user],
    );
    await client.query(
      "insert into habit_logs values($1,$2,'2024-02-29','2024-02-29T23:30:00-05:00')",
      [habit, user],
    );
    const { habitLogs } = await import("../../src/db/schema/index.ts");
    const [log] = await drizzle(client)
      .select()
      .from(habitLogs)
      .where(eq(habitLogs.habitId, habit));
    assert.equal(log?.localDate, "2024-02-29");
    assert.equal(log?.completedAt.toISOString(), "2024-03-01T04:30:00.000Z");
  } finally {
    await client.query("rollback");
  }
});
