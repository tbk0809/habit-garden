import pg from "pg";
import { assertLocalDatabaseTarget } from "../src/shared/server/db/local-target.ts";
import { seedFixtures } from "../src/shared/server/db/fixtures.ts";

try {
  if (process.argv.length !== 3 || process.argv[2] !== "--local-development")
    throw new Error("Explicit local confirmation required.");
  const url = process.env.MIGRATION_DATABASE_URL;
  assertLocalDatabaseTarget(url, process.env.NODE_ENV ?? "development", "seed");
  if (new URL(url).username !== "habit_garden_migrator")
    throw new Error("Local migration role required.");
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    const actual = await client.query(
      "select current_database() as database,current_user as owner",
    );
    if (
      actual.rows[0]?.database !== "habit_garden_dev" ||
      actual.rows[0]?.owner !== "habit_garden_migrator"
    )
      throw new Error("Local target refused.");
    await seedFixtures(client);
    console.log(
      "Local fictional fixtures verified. Real sign-in still requires GitHub OAuth configuration.",
    );
  } finally {
    await client.end();
  }
} catch {
  console.error(
    "Local seed refused or conflicted. Verify the explicit local-development flag, target, environment and existing fixture data; nothing is overwritten.",
  );
  process.exitCode = 1;
}
