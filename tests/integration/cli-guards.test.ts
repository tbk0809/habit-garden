import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { test } from "node:test";

test("seed and test CLI guards refuse unsafe intent before any connection", async () => {
  let connections = 0;
  const listener = createServer((socket) => {
    connections++;
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  assert.ok(address && typeof address !== "string");
  const dev = `postgresql://habit_garden_migrator:sensitive-placeholder@127.0.0.1:${address.port}/habit_garden_dev`;
  const testUrl = dev.replace("habit_garden_dev", "habit_garden_test");
  const cases = [
    {
      script: "scripts/seed.ts",
      args: [],
      environment: "development",
      url: dev,
    },
    {
      script: "scripts/seed.ts",
      args: ["--local-development"],
      environment: "production",
      url: dev,
    },
    {
      script: "scripts/seed.ts",
      args: ["--local-development"],
      environment: "development",
      url: testUrl,
    },
    {
      script: "scripts/seed.ts",
      args: ["--local-development"],
      environment: "development",
      url: `${dev}?host=remote`,
    },
    {
      script: "scripts/integration.ts",
      args: [],
      environment: "test",
      url: dev,
    },
    {
      script: "scripts/integration.ts",
      args: [],
      environment: "production",
      url: testUrl,
    },
  ] as const;
  try {
    for (const item of cases) {
      let output = "";
      const child = spawn(process.execPath, [item.script, ...item.args], {
        env: {
          ...process.env,
          NODE_ENV: item.environment,
          MIGRATION_DATABASE_URL: item.url,
          TEST_DATABASE_URL: item.url,
          TEST_RUNTIME_DATABASE_URL: item.url,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr.on("data", (chunk) => {
        output += chunk;
      });
      const status = await new Promise<number | null>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      assert.equal(status, 1);
      assert.match(output, /refused|failed/);
      assert.doesNotMatch(output, /sensitive-placeholder/);
    }
    assert.equal(
      connections,
      0,
      "Unsafe commands must be refused before any network connection",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      listener.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
