import "server-only";
import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";
import { requireDatabaseUrl } from "./database-url.ts";

let database:
  (NodePgDatabase<typeof schema> & { $client: pg.Pool }) | undefined;

// Both configuration and the connection pool are lazy. Import/build needs no DB
// or OAuth settings. pg opens connections only when a runtime query is made.
export function getDatabase() {
  if (!database) {
    const pool = new pg.Pool({
      connectionString: requireDatabaseUrl(process.env.DATABASE_URL),
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      statement_timeout: 10000,
    });
    // pg emits idle connection failures; keep credentials out of process logs.
    pool.on("error", () => console.error("Idle database connection failed."));
    database = drizzle(pool, { schema });
  }
  return database;
}
