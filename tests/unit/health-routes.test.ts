import { createServer, type Socket } from "node:net";
import { once } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkDatabaseReadiness } from "../../src/shared/server/health.ts";

// A tiny PostgreSQL wire peer exercises the real pg connection/query lifecycle,
// including hung startup and queries, without touching a database or app data.
async function peer(mode: "ready" | "startup-hang" | "query-hang" | "error") {
  const sockets = new Set<Socket>();
  const queries: string[] = [];
  const packet = (type: string, body: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeInt32BE(body.length + 4);
    return Buffer.concat([Buffer.from(type), length, body]);
  };
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    let startup = true;
    let pending = Buffer.alloc(0);
    socket.on("data", (data) => {
      pending = Buffer.concat([pending, data]);
      while (pending.length >= (startup ? 4 : 5)) {
        const length = pending.readInt32BE(startup ? 0 : 1) + (startup ? 0 : 1);
        if (pending.length < length) return;
        const message = pending.subarray(0, length);
        pending = pending.subarray(length);
        if (startup) {
          startup = false;
          if (mode === "startup-hang") continue;
          socket.write(
            Buffer.concat([
              packet("R", Buffer.alloc(4)),
              packet("Z", Buffer.from("I")),
            ]),
          );
        } else if (message[0] === "Q".charCodeAt(0)) {
          queries.push(message.subarray(5, -1).toString());
          if (mode === "query-hang") continue;
          if (mode === "error") {
            socket.write(
              packet(
                "E",
                Buffer.from("SERROR\0C08006\0Mprivate database failure\0\0"),
              ),
            );
          } else {
            socket.write(packet("C", Buffer.from("SELECT 1\0")));
          }
          socket.write(packet("Z", Buffer.from("I")));
        }
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture address unavailable.");
  return {
    url: `postgresql://fixture_user:fixture_password@127.0.0.1:${address.port}/wire_fixture?sslmode=disable`,
    queries,
    sockets,
    async close() {
      for (const socket of sockets) socket.destroy();
      server.close();
      await once(server, "close");
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("read-only health routes", () => {
  it("liveness ignores forged request metadata and later environment changes", async () => {
    vi.stubEnv("HABIT_GARDEN_BUILD_SOURCE_SHA", "c".repeat(40));
    vi.stubEnv("HABIT_GARDEN_BUILD_SOURCE_DIRTY", "true");
    const { GET } = await import("../../src/app/api/status/route.ts");
    vi.stubEnv("HABIT_GARDEN_BUILD_SOURCE_SHA", "d".repeat(40));
    vi.stubEnv("HABIT_GARDEN_BUILD_SOURCE_DIRTY", "false");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "");
    const handleRequest: (request: Request) => Promise<Response> = GET;
    const response = await handleRequest(
      new Request(`http://localhost/api/status?sourceSha=${"e".repeat(40)}`, {
        headers: { "x-source-sha": "f".repeat(40) },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      sourceSha: "c".repeat(40),
      sourceDirty: true,
    });
  });

  it("ready performs only SELECT 1 and closes its per-request connection", async () => {
    const fixture = await peer("ready");
    try {
      vi.stubEnv("DATABASE_URL", fixture.url);
      vi.stubEnv("AUTH_SECRET", "");
      vi.stubEnv("AUTH_GITHUB_ID", "");
      const { GET } = await import("../../src/app/api/ready/route.ts");
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ status: "ready" });
      expect(fixture.queries).toEqual(["SELECT 1"]);
      await vi.waitFor(() => expect(fixture.sockets.size).toBe(0), {
        timeout: 500,
      });
    } finally {
      await fixture.close();
    }
  });

  it.each(["", "not-a-database", "postgresql://private:secret@localhost"])(
    "returns only generic 503 for unavailable configuration (%s)",
    async (url) => {
      vi.stubEnv("DATABASE_URL", url);
      const { GET } = await import("../../src/app/api/ready/route.ts");
      const response = await GET();
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ status: "unavailable" });
    },
  );

  it("returns generic failure when the database sends a private error", async () => {
    const fixture = await peer("error");
    try {
      vi.stubEnv("DATABASE_URL", fixture.url);
      const { GET } = await import("../../src/app/api/ready/route.ts");
      const response = await GET();
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ status: "unavailable" });
      expect(fixture.queries).toEqual(["SELECT 1"]);
    } finally {
      await fixture.close();
    }
  });

  it.each(["startup-hang", "query-hang"] as const)(
    "bounds %s and releases the connection instead of retaining a pool",
    async (mode) => {
      const fixture = await peer(mode);
      try {
        const started = performance.now();
        expect(await checkDatabaseReadiness(fixture.url, 75)).toBe(false);
        expect(performance.now() - started).toBeLessThan(1000);
        await vi.waitFor(() => expect(fixture.sockets.size).toBe(0), {
          timeout: 500,
        });
        expect(fixture.queries).toEqual(
          mode === "query-hang" ? ["SELECT 1"] : [],
        );
      } finally {
        await fixture.close();
      }
    },
  );
});
