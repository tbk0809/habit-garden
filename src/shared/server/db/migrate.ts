import pg from "pg";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { fileURLToPath } from "node:url";
import { requireDatabaseUrl } from "./database-url.ts";

export const MIGRATION_LOCK = [7147068, 1] as const;

// The Client, lock and every migration statement share one direct session.
// MIGRATION_DATABASE_URL must be a direct endpoint, never a transaction pooler.
export async function migrateDatabase(
  connectionString: string,
): Promise<number> {
  const migrations = readMigrationFiles({
    migrationsFolder: fileURLToPath(
      new URL("../../../../drizzle", import.meta.url),
    ),
  });
  const client = new pg.Client({
    connectionString: requireDatabaseUrl(connectionString),
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    await client.query(
      "select set_config('lock_timeout',$1,false), set_config('statement_timeout',$2,false)",
      ["10000", "30000"],
    );
    await client.query("select pg_advisory_lock($1::int,$2::int)", [
      ...MIGRATION_LOCK,
    ]);
    await client.query("begin");
    try {
      await client.query("create schema if not exists drizzle");
      await client.query(
        "create table if not exists drizzle.__drizzle_migrations(id serial primary key, hash text not null, created_at bigint not null unique)",
      );
      const applied = await client.query<{ hash: string; created_at: string }>(
        "select hash,created_at from drizzle.__drizzle_migrations order by created_at",
      );
      if (applied.rows.length > migrations.length)
        throw new Error("Migration history differs from reviewed files.");
      for (const [index, row] of applied.rows.entries()) {
        const migration = migrations[index];
        if (
          !migration ||
          row.hash !== migration.hash ||
          Number(row.created_at) !== migration.folderMillis
        )
          throw new Error("Migration history differs from reviewed files.");
      }
      for (const migration of migrations.slice(applied.rows.length)) {
        for (const statement of migration.sql) await client.query(statement);
        await client.query(
          "insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)",
          [migration.hash, migration.folderMillis],
        );
      }
      await client.query("commit");
      return migrations.length - applied.rows.length;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  } finally {
    // Closing also releases the session lock if a statement/unlock fails.
    await client.end();
  }
}
