import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium, expect } from "@playwright/test";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema/index.ts";
import { confirmTimeZoneForSession } from "../../src/features/auth/onboarding.ts";
import { createHabitForSession } from "../../src/features/habits/service.ts";
import { createSessionFixture } from "../helpers/session.ts";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";

assertLocalDatabaseTarget(
  process.env.TEST_RUNTIME_DATABASE_URL,
  process.env.NODE_ENV,
  "test",
);
const origin = "http://localhost:3106";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3106", "-H", "127.0.0.1"],
  {
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: process.env.TEST_RUNTIME_DATABASE_URL,
      AUTH_URL: origin,
      AUTH_SECRET: "fictional-browser-test-secret-with-at-least-32-characters",
      AUTH_GITHUB_ID: "fictional-client-id",
      AUTH_GITHUB_SECRET: "fictional-client-secret",
    },
    stdio: "ignore",
  },
);
const pool = new pg.Pool({
  connectionString: process.env.TEST_RUNTIME_DATABASE_URL,
  max: 2,
});
const db = drizzle(pool, { schema });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
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
  assert.ok(ready, "Local smoke server did not start.");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 320, height: 780 },
  });
  const fixture = await createSessionFixture();
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: fixture.token,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const session = await (
    await context.request.get(`${origin}/api/auth/session`)
  ).json();
  assert.equal(
    (await confirmTimeZoneForSession(db, session, { timeZone: "UTC" })).ok,
    true,
  );
  const page = await context.newPage();
  await page.goto(`${origin}/dashboard`);
  await expect(
    page.getByText("Your first daily habit will take root here."),
  ).toBeVisible();
  const title = page.getByLabel("Daily habit title");
  const create = page.getByRole("button", {
    name: "Create habit",
    exact: true,
  });
  await title.fill("   ");
  await create.click();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveValue("   ");
  await expect(title).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: "1–80 characters" }),
  ).toBeVisible();

  // Hold the real shared user lock so pending UI is observable without intercepting actions.
  const blocker = await pool.connect();
  try {
    await blocker.query("begin");
    await blocker.query("select id from users where id=$1 for update", [
      fixture.user.id,
    ]);
    await title.fill("  Read  ");
    await create.click();
    await expect(
      page.getByRole("button", { name: "Creating…", exact: true }),
    ).toBeDisabled();
    await expect(title).toBeDisabled();
    await expect(
      page.getByRole("heading", { name: "Read", exact: true }),
    ).toHaveCount(0);
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
  await expect(
    page.getByRole("heading", { name: "Read", exact: true }),
  ).toBeVisible();
  await expect(title).toHaveValue("");
  await expect(title).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Created Read.");
  await expect(
    page.getByText("Current streak: 0 · Best streak: 0", { exact: true }),
  ).toBeVisible();
  const longestTitle = "a".repeat(80);
  await title.fill(longestTitle);
  await create.click();
  await expect(
    page.getByRole("heading", { name: longestTitle, exact: true }),
  ).toHaveText(longestTitle);
  const narrowLayout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
  }));
  assert.ok(
    narrowLayout.page <= narrowLayout.viewport,
    `A valid 80-character unbroken habit title overflowed: page ${narrowLayout.page}px, viewport ${narrowLayout.viewport}px.`,
  );
  await page
    .getByRole("button", { name: `Archive ${longestTitle}`, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: longestTitle, exact: true }),
  ).toHaveCount(0);
  await title.fill("Walk");
  await create.click();
  await expect(
    page.getByRole("heading", { name: "Walk", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive Walk", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Walk", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Archive Read", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("status")).toContainText(
    "Archived Walk. History and rewards are kept.",
  );
  await page.getByRole("button", { name: "Archive Read", exact: true }).click();
  await expect(
    page.getByText("Your first daily habit will take root here."),
  ).toBeVisible();
  await expect(title).toBeFocused();
  await expect(
    page.getByText("0 lifetime completions", { exact: true }),
  ).toBeVisible();

  for (let n = 1; n <= 10; n++) {
    assert.equal(
      (await createHabitForSession(db, session, { title: `Habit ${n}` })).ok,
      true,
    );
  }
  await page.reload();
  await title.fill("Keep this title");
  await create.click();
  await expect(
    page.getByRole("alert").filter({ hasText: "ten active habits" }),
  ).toBeVisible();
  await expect(title).toHaveValue("Keep this title");
  await expect(
    page.getByRole("button", { name: /^Archive Habit / }),
  ).toHaveCount(10);
  await page
    .getByRole("button", { name: "Archive Habit 1", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Archive Habit / }),
  ).toHaveCount(9);
  await expect(title).toHaveValue("Keep this title");
  await create.click();
  await expect(
    page.getByRole("heading", { name: "Keep this title", exact: true }),
  ).toBeVisible();
  await expect(title).toHaveValue("");
  for (const viewport of [
    { width: 320, height: 780 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
  }
  const stored = await pool.query(
    "select count(*)::int as all_habits,count(*) filter(where archived_at is null)::int as active from habits where user_id=$1",
    [fixture.user.id],
  );
  assert.deepEqual(stored.rows[0], { all_habits: 14, active: 10 });
  await context.close();
  console.log(
    "Habit browser smoke passed: real-session empty/create/validation, real-lock pending without optimistic rows, title clear and focus, archive feedback and focus, cap preserves title, archive frees capacity, 80-character unbroken title at 320px, 320px/desktop layout.",
  );
} finally {
  await browser?.close();
  await pool.end();
  server.kill();
  if (server.exitCode === null && server.signalCode === null)
    await once(server, "exit");
}
