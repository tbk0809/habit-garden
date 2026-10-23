import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { chromium, expect, type Page } from "@playwright/test";
import { completionHarness } from "../helpers/completion.ts";
import { createHabitForSession } from "../../src/features/habits/service.ts";

const h = await completionHarness();
const origin = "http://localhost:3107";
const runtimeUrl = new URL(process.env.TEST_RUNTIME_DATABASE_URL!);
runtimeUrl.searchParams.set(
  "options",
  `-c search_path=${h.ns},pg_catalog,public`,
);
const o = await h.owner();
const dates = (
  await h.pool.query(
    "select (clock_timestamp() at time zone 'UTC')::date::text as today,((clock_timestamp() at time zone 'UTC')::date-1)::text as yesterday,((clock_timestamp() at time zone 'UTC')::date+1)::text as tomorrow",
  )
).rows[0];
await h.admin.query(`insert into ${h.ns}.clocks values(0,$1,null)`, [
  `${dates.today}T12:00:00Z`,
]);
await h.seedRun(o.user.id, o.habitId, 4, dates.yesterday);
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3107", "-H", "127.0.0.1"],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: runtimeUrl.toString(),
      AUTH_URL: origin,
      AUTH_SECRET: "fictional-browser-test-secret-with-at-least-32-characters",
      AUTH_GITHUB_ID: "fictional-client-id",
      AUTH_GITHUB_SECRET: "fictional-client-secret",
    },
    stdio: "ignore",
  },
);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
async function dropNextAction(page: Page) {
  let intercepted = false;
  await page.route("**/dashboard", async (route) => {
    if (route.request().method() !== "POST" || intercepted)
      return route.continue();
    intercepted = true;
    const response = await route.fetch();
    assert.equal(
      response.status(),
      200,
      "The real action must commit before its response is discarded",
    );
    await route.abort("failed");
  });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: o.token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto(`${origin}/dashboard`);
  await expect(
    page.getByText("4 lifetime completions", { exact: true }),
  ).toBeVisible();
  const complete = page.getByRole("button", {
    name: "Complete Read",
    exact: true,
  });
  await expect(complete).toBeEnabled();
  const blocker = await h.pool.connect();
  try {
    await blocker.query("begin");
    await blocker.query("select id from users where id=$1 for update", [
      o.user.id,
    ]);
    await complete.click();
    await expect(
      page.getByRole("button", { name: "Completing…", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText("4 lifetime completions", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Not completed today", { exact: true }),
    ).toBeVisible();
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
  await expect(
    page.getByRole("button", { name: "Completed Read", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("5 lifetime completions", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Completed Read. Garden total: 5 lifetime completions. Daisy unlocked at sprout.",
  );
  await mkdir(".superpowers/sdd/05-task-breakdown/screenshots", {
    recursive: true,
  });
  await page.screenshot({
    path: ".superpowers/sdd/05-task-breakdown/screenshots/task-7-desktop.png",
    fullPage: true,
  });

  const walk = await createHabitForSession(h.db, o.session, { title: "Walk" });
  assert.equal(walk.ok, true);
  await page.reload();
  await dropNextAction(page);
  await page
    .getByRole("button", { name: "Complete Walk", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "try again" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Complete Walk", exact: true }),
  ).toBeEnabled();
  assert.equal((await h.stored(o.user.id)).garden.lifetime_completion_count, 6);
  await page.unroute("**/dashboard");
  await page
    .getByRole("button", { name: "Try completion again", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Completed Walk", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("6 lifetime completions", { exact: true }),
  ).toBeVisible();
  assert.equal((await h.stored(o.user.id)).logs.length, 6);

  const stretch = await createHabitForSession(h.db, o.session, {
    title: "Stretch",
  });
  assert.equal(stretch.ok, true);
  await page.reload();
  await dropNextAction(page);
  await page
    .getByRole("button", { name: "Complete Stretch", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Try completion again", exact: true }),
  ).toBeVisible();
  await page.unroute("**/dashboard");
  await h.admin.query(`update ${h.ns}.clocks set instant=$1 where pid=0`, [
    `${dates.tomorrow}T00:00:01Z`,
  ]);
  await page
    .getByRole("button", { name: "Try completion again", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "The day changed" }),
  ).toBeVisible();
  await expect(page.locator("time")).toHaveText(dates.tomorrow);
  await expect(
    page.getByText("7 lifetime completions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try completion again", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Complete Stretch", exact: true }),
  ).toBeEnabled();
  assert.equal(
    (await h.stored(o.user.id)).logs.length,
    7,
    "Refresh must not resubmit for the new day",
  );
  await page
    .getByRole("button", { name: "Complete Stretch", exact: true })
    .click();
  await expect(
    page.getByText("8 lifetime completions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Completed Stretch", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText(
    "Garden total: 8 lifetime completions. Daisy is now seedling.",
  );
  await page.reload();
  await expect(
    page.getByText("8 lifetime completions", { exact: true }),
  ).toBeVisible();
  for (const viewport of [
    { width: 320, height: 900 },
    { width: 1280, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: `.superpowers/sdd/05-task-breakdown/screenshots/task-7-${viewport.width}.png`,
      fullPage: true,
    });
  }
  assert.equal((await h.stored(o.user.id)).garden.lifetime_completion_count, 8);
  await context.close();
  console.log(
    "Completion browser smoke passed: real-lock pending, no optimistic reward, threshold garden, committed lost-response retry, rollover refresh with explicit new submission, authenticated revalidation, 320px/desktop screenshots.",
  );
} finally {
  await browser?.close();
  server.kill();
  if (server.exitCode === null && server.signalCode === null)
    await once(server, "exit");
  await h.close();
}
