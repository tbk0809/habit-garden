import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { completionHarness } from "./completion.ts";

export const origin = "http://localhost:3108";
export const unavailableOrigin = "http://localhost:3109";
type Harness = Awaited<ReturnType<typeof completionHarness>>;
type App = {
  h: Harness;
  today: string;
  yesterday: string;
  tomorrow: string;
  clock(date: string): Promise<void>;
};

async function startServer(port: number, env: Partial<NodeJS.ProcessEnv>) {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen({ port, host: "127.0.0.1", exclusive: true }, resolve);
  });
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      String(port),
      "-H",
      "127.0.0.1",
    ],
    {
      env: { ...process.env, ...env, NODE_ENV: "production" },
      stdio: "ignore",
    },
  );
  try {
    for (let attempt = 0; attempt < 75; attempt++) {
      if (server.exitCode !== null || server.signalCode !== null) break;
      try {
        if (
          (
            await fetch(`http://localhost:${port}`, {
              signal: AbortSignal.timeout(1000),
            })
          ).ok
        )
          return server;
      } catch {
        /* Local server is starting. */
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error("Isolated browser server did not start.");
  } catch (error) {
    server.kill();
    throw error;
  }
}

export const test = base.extend<object, { app: App }>({
  app: [
    async ({}, use) => {
      assert.equal(process.env.NODE_ENV, "test");
      const h = await completionHarness();
      let server: ReturnType<typeof spawn> | undefined;
      let unavailableServer: ReturnType<typeof spawn> | undefined;
      try {
        const build = JSON.parse(
          await readFile(".next/required-server-files.json", "utf8"),
        ).config.env;
        const sourceSha = build.HABIT_GARDEN_BUILD_SOURCE_SHA;
        const sourceDirty = build.HABIT_GARDEN_BUILD_SOURCE_DIRTY;
        assert.match(sourceSha, /^[0-9a-f]{40}$/);
        assert.ok(sourceDirty === "true" || sourceDirty === "false");
        const dates = (
          await h.pool.query(
            "select (clock_timestamp() at time zone 'UTC')::date::text as today,((clock_timestamp() at time zone 'UTC')::date-1)::text as yesterday,((clock_timestamp() at time zone 'UTC')::date+1)::text as tomorrow",
          )
        ).rows[0];
        await h.admin.query(`insert into ${h.ns}.clocks values(0,$1,null)`, [
          `${dates.today}T12:00:00Z`,
        ]);
        const runtimeUrl = new URL(process.env.TEST_RUNTIME_DATABASE_URL!);
        runtimeUrl.searchParams.set(
          "options",
          `-c search_path=${h.ns},pg_catalog,public -c statement_timeout=12000`,
        );
        server = await startServer(3108, {
          DATABASE_URL: runtimeUrl.toString(),
          AUTH_URL: origin,
          AUTH_SECRET:
            "fictional-browser-test-secret-with-at-least-32-characters",
          AUTH_GITHUB_ID: "fictional-client-id",
          AUTH_GITHUB_SECRET: "fictional-client-secret",
          HABIT_GARDEN_BUILD_SOURCE_SHA: "f".repeat(40),
          HABIT_GARDEN_BUILD_SOURCE_DIRTY:
            sourceDirty === "true" ? "false" : "true",
        });
        unavailableServer = await startServer(3109, {
          DATABASE_URL: "",
          AUTH_SECRET: "",
          AUTH_GITHUB_ID: "",
          AUTH_GITHUB_SECRET: "",
          AUTH_URL: unavailableOrigin,
          HABIT_GARDEN_BUILD_SOURCE_SHA: "f".repeat(40),
          HABIT_GARDEN_BUILD_SOURCE_DIRTY:
            sourceDirty === "true" ? "false" : "true",
        });
        // Runtime env, request queries and headers cannot choose build identity.
        for (const runtimeOrigin of [origin, unavailableOrigin]) {
          const status = await fetch(
            `${runtimeOrigin}/api/status?sourceSha=${"0".repeat(40)}&sourceDirty=false`,
            {
              headers: {
                "x-source-sha": "0".repeat(40),
                "x-source-dirty": "false",
              },
            },
          );
          expect(status.status).toBe(200);
          expect(status.headers.get("cache-control")).toContain("no-store");
          expect(await status.json()).toEqual({
            status: "ok",
            sourceSha,
            sourceDirty: sourceDirty === "true",
          });
        }
        const ready = await fetch(`${origin}/api/ready`);
        expect(ready.status).toBe(200);
        expect(await ready.json()).toEqual({ status: "ready" });
        const unavailable = await fetch(`${unavailableOrigin}/api/ready`);
        expect(unavailable.status).toBe(503);
        expect(await unavailable.json()).toEqual({ status: "unavailable" });
        await use({
          h,
          ...dates,
          async clock(date) {
            await h.admin.query(
              `update ${h.ns}.clocks set instant=$1 where pid=0`,
              [`${date}T12:00:00Z`],
            );
          },
        });
      } finally {
        for (const child of [server, unavailableServer]) {
          if (child && child.exitCode === null && child.signalCode === null) {
            child.kill();
            await once(child, "exit");
          }
        }
        await h.close();
      }
    },
    { scope: "worker", timeout: 30000 },
  ],
});

export { expect };

export async function authenticate(context: BrowserContext, token: string) {
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function loseNextActionResponse(page: Page) {
  let intercepted = false;
  await page.route("**/dashboard", async (route) => {
    if (route.request().method() !== "POST" || intercepted)
      return route.continue();
    intercepted = true;
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
}

export async function substituteHabit(
  page: Page,
  ownId: string,
  targetId: string,
) {
  let intercepted = false;
  await page.route("**/dashboard", async (route) => {
    if (route.request().method() !== "POST" || intercepted)
      return route.continue();
    intercepted = true;
    const body = route.request().postData();
    assert.ok(
      body && body.includes(ownId),
      "Browser action must carry the owned habit command.",
    );
    await route.continue({ postData: body.replace(ownId, targetId) });
  });
}

export async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 12; count++) {
    if (await target.evaluate((element) => element === document.activeElement))
      return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}

export async function expectFitsViewport(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

export async function expectTextContrast(target: Locator) {
  const ratio = await target.evaluate((element) => {
    function rgb(value: string) {
      const parts = value.match(/[\d.]+/g)?.map(Number);
      if (!parts || parts.length < 3)
        throw new Error("Unsupported computed color.");
      return parts;
    }
    const foreground = rgb(getComputedStyle(element).color);
    let current: Element | null = element;
    let background: number[] | undefined;
    while (current) {
      const color = rgb(getComputedStyle(current).backgroundColor);
      if (color.length === 3 || color[3] === 1) {
        background = color;
        break;
      }
      if (color[3] !== 0)
        throw new Error("Contrast sample needs a solid background.");
      current = current.parentElement;
    }
    if (!background) throw new Error("No computed page background.");
    function luminance(color: number[]) {
      const channels = color.slice(0, 3).map((value) => {
        const channel = value / 255;
        return channel <= 0.04045
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return (
        channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
      );
    }
    const values = [luminance(foreground), luminance(background)].sort(
      (a, b) => a - b,
    );
    return (values[1]! + 0.05) / (values[0]! + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}
