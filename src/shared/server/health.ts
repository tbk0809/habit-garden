import { Socket } from "node:net";
import pg from "pg";
import { requireDatabaseUrl } from "./db/database-url.ts";

export async function checkDatabaseReadiness(
  url: unknown,
  timeoutMs = 2000,
): Promise<boolean> {
  let client: pg.Client | undefined;
  let transport: Socket | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const connectionString = requireDatabaseUrl(url);
    transport = new Socket();
    const ownedTransport = transport;
    client = new pg.Client({
      connectionString,
      stream: () => ownedTransport,
      connectionTimeoutMillis: timeoutMs,
      query_timeout: timeoutMs,
      statement_timeout: timeoutMs,
    });
    // Errors are deliberately omitted from this public probe and its logs.
    client.on("error", () => {});
    const probeClient = client;
    const probe = (async () => {
      await probeClient.connect();
      await probeClient.query("SELECT 1");
      return true;
    })();
    const deadline = new Promise<false>((resolve) => {
      timeout = setTimeout(() => resolve(false), timeoutMs);
    });
    return await Promise.race([probe, deadline]);
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
    // Own the raw socket so even a peer that ignores shutdown cannot retain a
    // connection after the deadline. This also closes any TLS wrapper over it.
    const closing = client?.end();
    transport?.destroy();
    await closing?.catch(() => {});
  }
}
