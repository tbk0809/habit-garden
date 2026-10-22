import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "@playwright/test";
import pg from "pg";
import { createSessionFixture } from "../helpers/session.ts";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";

assertLocalDatabaseTarget(
  process.env.TEST_DATABASE_URL,
  process.env.NODE_ENV,
  "test",
);
assertLocalDatabaseTarget(
  process.env.TEST_RUNTIME_DATABASE_URL,
  process.env.NODE_ENV,
  "test",
);
const origin = "http://localhost:3105";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3105", "-H", "127.0.0.1"],
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
const admin = new pg.Client({
  connectionString: process.env.TEST_DATABASE_URL,
});
await admin.connect();
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const response = await fetch(origin);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Server is starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, "Local smoke server did not start.");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 320, height: 780 },
  });
  const page = await context.newPage();
  await page.goto(`${origin}/dashboard`);
  await page.waitForURL(origin + "/");
  await page.getByRole("button", { name: "Continue with GitHub" }).waitFor();
  let authorizationRequested = false;
  await page.route(
    "https://github.com/login/oauth/authorize?*",
    async (route) => {
      const target = new URL(route.request().url());
      assert.equal(target.searchParams.get("scope"), "read:user");
      assert.equal(
        target.searchParams.get("redirect_uri"),
        `${origin}/api/auth/callback/github`,
      );
      authorizationRequested = true;
      // Observe the outbound authorization request without contacting GitHub.
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "Authorization request captured by test runner.",
      });
    },
  );
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await page.waitForURL("https://github.com/login/oauth/authorize?*");
  assert.equal(authorizationRequested, true);
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
  await page.goto(`${origin}/dashboard`);
  await page.waitForURL(`${origin}/onboarding`);
  await page.getByLabel("Your IANA timezone").fill("Mars/Olympus");
  await page
    .getByRole("button", { name: "Confirm timezone and start" })
    .click();
  await page
    .getByText("Choose a supported IANA timezone.", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Your IANA timezone").inputValue(),
    "Mars/Olympus",
  );
  await page.getByLabel("Your IANA timezone").fill("UTC");
  await page
    .getByRole("button", { name: "Confirm timezone and start" })
    .click();
  await page.waitForURL(`${origin}/dashboard`);
  await page.getByText("0 lifetime completions", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: ".superpowers/sdd/05-task-breakdown/task-5-dashboard-320.png",
    fullPage: true,
  });

  // Real adapter permission failure: the Auth.js route must not clear the
  // cookie or report sign-out while revocation has not committed.
  await admin.query("revoke delete on sessions from habit_garden_runtime");
  try {
    await page.getByRole("link", { name: "Sign out", exact: true }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page
      .getByRole("heading", { name: "We couldn't finish that" })
      .waitFor();
    assert.ok(
      (await context.cookies()).some(
        (cookie) =>
          cookie.name === "authjs.session-token" &&
          cookie.value === fixture.token,
      ),
    );
    assert.equal(
      (
        await admin.query(
          "select count(*)::int as count from sessions where session_token=$1",
          [fixture.token],
        )
      ).rows[0].count,
      1,
    );
  } finally {
    await admin.query("grant delete on sessions to habit_garden_runtime");
  }
  const privateResponse = await page.goto(`${origin}/dashboard`);
  assert.match(privateResponse!.headers()["cache-control"]!, /no-store/);
  await page.getByRole("heading", { name: "Your daily garden" }).waitFor();
  await page.getByRole("link", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(origin + "/");
  assert.equal(
    (
      await admin.query(
        "select count(*)::int as count from sessions where session_token=$1",
        [fixture.token],
      )
    ).rows[0].count,
    0,
  );
  await page.goto(`${origin}/dashboard`);
  await page.waitForURL(origin + "/");
  await context.close();
  console.log(
    "Browser smoke passed: signed-out protection, intercepted GitHub sign-in request, real-session onboarding/validation, 320px layout, failed revocation retains session, successful revocation protects dashboard, private page no-store.",
  );
} finally {
  await browser?.close();
  await admin.end();
  server.kill();
  if (server.exitCode === null && server.signalCode === null)
    await once(server, "exit");
}
