import { migrateDatabase } from "../src/shared/server/db/migrate.ts";
import { requireDatabaseUrl } from "../src/shared/server/db/database-url.ts";

try {
  const count = await migrateDatabase(
    requireDatabaseUrl(process.env.MIGRATION_DATABASE_URL),
  );
  console.log(`Reviewed migrations applied: ${count}.`);
} catch {
  console.error(
    "Database migration failed. Verify the direct migration endpoint, role and reviewed journal.",
  );
  process.exitCode = 1;
}
