import { randomUUID } from "node:crypto";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { adapterTables } from "../../src/db/schema/index.ts";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";

// Test-runner code only. Never imported by the application or served as a route.
export async function createSessionFixture(
  expires = new Date(Date.now() + 3600000),
) {
  assertLocalDatabaseTarget(
    process.env.TEST_RUNTIME_DATABASE_URL,
    process.env.NODE_ENV,
    "test",
  );
  const client = new pg.Client({
    connectionString: process.env.TEST_RUNTIME_DATABASE_URL,
  });
  await client.connect();
  try {
    const actual = await client.query(
      "select current_database() as database, current_user as role",
    );
    if (
      actual.rows[0]?.database !== "habit_garden_test" ||
      actual.rows[0]?.role !== "habit_garden_runtime"
    )
      throw new Error("Fixture database refused.");
    const adapter = DrizzleAdapter(drizzle(client), adapterTables);
    const user = await adapter.createUser!({
      id: randomUUID(),
      name: "Session fixture",
      email: `${randomUUID()}@example.invalid`,
      emailVerified: null,
      image: null,
    });
    const token = randomUUID();
    await adapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "github",
      providerAccountId: randomUUID(),
    });
    await adapter.createSession!({
      sessionToken: token,
      userId: user.id,
      expires,
    });
    return { user, token, cookie: `authjs.session-token=${token}` };
  } finally {
    await client.end();
  }
}
