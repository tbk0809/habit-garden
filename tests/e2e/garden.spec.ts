import { randomUUID } from "node:crypto";
import { createSessionFixture } from "../helpers/session.ts";
import { createHabitForSession } from "../../src/features/habits/service.ts";
import {
  test,
  expect,
  origin,
  unavailableOrigin,
  authenticate,
  loseNextActionResponse,
  substituteHabit,
  tabTo,
  expectFitsViewport,
  expectTextContrast,
} from "../helpers/e2e.ts";

test("first visit, real-session onboarding, creation and completion survive refresh with garden feedback", async ({
  app,
  page,
  context,
}) => {
  await app.clock(app.today);
  await page.goto(`${unavailableOrigin}/dashboard`);
  await expect(
    page.getByRole("heading", { name: "We couldn't load your garden" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Try again", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "We couldn't load your garden" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(`${origin}/`);
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your daily garden" }),
  ).toHaveCount(0);
  const expired = await createSessionFixture(new Date(Date.now() - 60000));
  await authenticate(context, expired.token);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(`${origin}/`);
  const fixture = await createSessionFixture();
  await authenticate(context, fixture.token);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(`${origin}/onboarding`);
  const zone = page.getByLabel("Your IANA timezone");
  await zone.fill("Mars/Olympus");
  await page
    .getByRole("button", { name: "Confirm timezone and start" })
    .click();
  await expect(zone).toHaveValue("Mars/Olympus");
  await expect(zone).toHaveAttribute("aria-invalid", "true");
  await expect(zone).toBeFocused();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Choose a supported IANA timezone.",
  );
  await zone.fill("UTC");
  await page
    .getByRole("button", { name: "Confirm timezone and start" })
    .click();
  await expect(page).toHaveURL(`${origin}/dashboard`);
  await expect(
    page.getByText("Your first daily habit will take root here."),
  ).toBeVisible();
  const garden = page.getByRole("region", { name: "Your garden" });
  await expect(garden.locator("svg")).toHaveCount(4);
  await expect(
    garden.getByText("Unlocks at 5 lifetime completions", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Daily habit title").fill("Read");
  await page.getByRole("button", { name: "Create habit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Read", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Daily habit title")).toHaveValue("");
  await expect(page.getByLabel("Daily habit title")).toBeFocused();
  const habit = (
    await app.h.pool.query("select id from habits where user_id=$1", [
      fixture.user.id,
    ])
  ).rows[0];
  await app.h.seedRun(fixture.user.id, habit.id, 4, app.yesterday);
  await page.reload();
  await expect(
    page.getByText("4 lifetime completions", { exact: true }),
  ).toBeVisible();
  const clover = garden.locator("li").filter({
    has: page.getByRole("heading", { name: "Clover", exact: true }),
  });
  const beforeSvg = await clover.locator("svg").innerHTML();
  const blocker = await app.h.pool.connect();
  try {
    await blocker.query("begin");
    await blocker.query("select id from users where id=$1 for update", [
      fixture.user.id,
    ]);
    await page
      .getByRole("button", { name: "Complete Read", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Completing…", exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole("status")).toContainText(
      "Completing your habit…",
    );
    await expect(
      page.getByText("4 lifetime completions", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Not completed today", { exact: true }),
    ).toBeVisible();
    expect(await clover.locator("svg").innerHTML()).toBe(beforeSvg);
    expect((await app.h.stored(fixture.user.id)).logs).toHaveLength(4);
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
  await expect(
    page.getByRole("button", { name: "Completed Read", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Current streak: 5 · Best streak: 5", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Garden total: 5 lifetime completions. Daisy unlocked at sprout.",
  );
  const daisy = garden
    .locator("li")
    .filter({ has: page.getByRole("heading", { name: "Daisy", exact: true }) });
  await expect(daisy.getByText("Sprout", { exact: true })).toBeVisible();
  await expect(
    daisy.getByText("0 growth points", { exact: true }),
  ).toBeVisible();
  await expect(daisy.locator("svg")).toHaveAttribute("aria-hidden", "true");
  const daisySvg = await daisy.locator("svg").innerHTML();
  const response = await page.reload();
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    page.getByText("5 lifetime completions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Current streak: 5 · Best streak: 5", { exact: true }),
  ).toBeVisible();
  expect(await daisy.locator("svg").innerHTML()).toBe(daisySvg);
  expect((await app.h.stored(fixture.user.id)).logs).toHaveLength(5);
  await page.getByRole("link", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/`);
  expect(
    Number(
      (
        await app.h.pool.query(
          "select count(*) as count from sessions where session_token=$1",
          [fixture.token],
        )
      ).rows[0].count,
    ),
  ).toBe(0);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(`${origin}/`);
});

test("lost-response retries are idempotent, rollover requires a new click, and archive retains history", async ({
  app,
  page,
  context,
}) => {
  await app.clock(app.today);
  const owner = await app.h.owner();
  await authenticate(context, owner.token);
  await page.goto("/dashboard");
  await loseNextActionResponse(page);
  await page
    .getByRole("button", { name: "Complete Read", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "try again",
  );
  await expect(
    page.getByText("0 lifetime completions", { exact: true }),
  ).toBeVisible();
  expect((await app.h.stored(owner.user.id)).logs).toHaveLength(1);
  await page.unroute("**/dashboard");
  await page
    .getByRole("button", { name: "Try completion again", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Read was already completed today. No extra reward was added.",
  );
  await expect(
    page.getByText("1 lifetime completion", { exact: true }),
  ).toBeVisible();
  expect((await app.h.stored(owner.user.id)).logs).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Completed Read", exact: true }),
  ).toBeDisabled();
  const created = await createHabitForSession(app.h.db, owner.session, {
    title: "Walk",
  });
  expect(created.ok).toBe(true);
  await page.reload();
  await loseNextActionResponse(page);
  await page
    .getByRole("button", { name: "Complete Walk", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Try completion again", exact: true }),
  ).toBeVisible();
  expect((await app.h.stored(owner.user.id)).logs).toHaveLength(2);
  await page.unroute("**/dashboard");
  await app.clock(app.tomorrow);
  await page
    .getByRole("button", { name: "Try completion again", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "The day changed",
  );
  await expect(page.locator("time")).toHaveText(app.tomorrow);
  await expect(
    page.getByRole("button", { name: "Try completion again", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Complete Walk", exact: true }),
  ).toBeEnabled();
  expect((await app.h.stored(owner.user.id)).logs).toHaveLength(2);
  await page
    .getByRole("button", { name: "Complete Walk", exact: true })
    .click();
  await expect(
    page.getByText("3 lifetime completions", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Clover is now seedling.",
  );
  const retained = await app.h.stored(owner.user.id);
  await page.getByRole("button", { name: "Archive Walk", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Walk", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Archive Read", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Archive Read", exact: true }).click();
  await expect(
    page.getByText("Your first daily habit will take root here."),
  ).toBeVisible();
  await expect(page.getByLabel("Daily habit title")).toBeFocused();
  await expect(page.getByRole("status")).toContainText(
    "History and rewards are kept.",
  );
  await page.reload();
  await expect(
    page.getByText("3 lifetime completions", { exact: true }),
  ).toBeVisible();
  expect(await app.h.stored(owner.user.id)).toEqual(retained);
  expect(
    Number(
      (
        await app.h.pool.query(
          "select count(*) as count from habits where user_id=$1 and archived_at is not null",
          [owner.user.id],
        )
      ).rows[0].count,
    ),
  ).toBe(2);
  const title = page.getByLabel("Daily habit title");
  await title.fill("Keep this title");
  await page.route("**/dashboard", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Create habit", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Please try again",
  );
  await expect(title).toHaveValue("Keep this title");
  await expect(
    page.getByText("3 lifetime completions", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/dashboard");
  await page.getByRole("button", { name: "Create habit", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Keep this title", exact: true }),
  ).toBeVisible();
});

test("owner isolation holds through browser actions and keyboard use works at 320px with reduced motion", async ({
  app,
  page,
  context,
}) => {
  await app.clock(app.today);
  const owner = await app.h.owner();
  const other = await app.h.owner();
  const secret = await createHabitForSession(app.h.db, other.session, {
    title: "Private second-user habit",
  });
  expect(secret.ok).toBe(true);
  if (!secret.ok) throw new Error("Second-user fixture failed.");
  const otherState = await app.h.stored(other.user.id);
  const otherHabits = (
    await app.h.pool.query(
      "select * from habits where user_id=$1 order by id",
      [other.user.id],
    )
  ).rows;
  await authenticate(context, owner.token);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/dashboard?habitId=${secret.data.habitId}`);
  await expect(
    page.getByRole("heading", {
      name: "Private second-user habit",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.goto("/dashboard");
  for (const target of [secret.data.habitId, randomUUID()]) {
    for (const action of ["Complete Read", "Archive Read"]) {
      await substituteHabit(page, owner.habitId, target);
      await page.getByRole("button", { name: action, exact: true }).click();
      await expect(page.locator("main").getByRole("alert")).toHaveText(
        "That habit is no longer available. Refresh your list and try again.",
      );
      await expect(
        page.getByRole("heading", {
          name: "Private second-user habit",
          exact: true,
        }),
      ).toHaveCount(0);
      await page.unroute("**/dashboard");
      await page.reload();
    }
  }
  expect(await app.h.stored(other.user.id)).toEqual(otherState);
  expect(
    (
      await app.h.pool.query(
        "select * from habits where user_id=$1 order by id",
        [other.user.id],
      )
    ).rows,
  ).toEqual(otherHabits);
  expect((await app.h.stored(owner.user.id)).logs).toHaveLength(0);
  const title = page.getByLabel("Daily habit title");
  const create = page.getByRole("button", {
    name: "Create habit",
    exact: true,
  });
  await tabTo(page, title);
  await expect(title).toBeFocused();
  expect(
    await title.evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe("3px");
  await page.keyboard.type("   ");
  await page.keyboard.press("Tab");
  await expect(create).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await expect(title).toHaveValue("   ");
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute(
    "aria-describedby",
    "habit-title-help habit-error",
  );
  const longestTitle = "a".repeat(80);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(longestTitle);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: longestTitle, exact: true }),
  ).toBeVisible();
  await expect(title).toBeFocused();
  await expectFitsViewport(page);
  const complete = page.getByRole("button", {
    name: `Complete ${longestTitle}`,
    exact: true,
  });
  await tabTo(page, complete);
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", {
      name: `Completed ${longestTitle}`,
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByText("1 lifetime completion", { exact: true }),
  ).toBeVisible();
  const archive = page.getByRole("button", {
    name: `Archive ${longestTitle}`,
    exact: true,
  });
  await tabTo(page, archive);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: longestTitle, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Archive Read", exact: true }),
  ).toBeFocused();
  await expectFitsViewport(page);
  const garden = page.getByRole("region", { name: "Your garden" });
  for (const sample of [
    page.locator("#habit-title-help"),
    page.locator(".eyebrow"),
    page.getByRole("link", { name: "Sign out", exact: true }),
    create,
    page.getByRole("button", { name: "Archive Read", exact: true }),
    garden.getByText("Sprout", { exact: true }),
    garden.getByText("Locked", { exact: true }).first(),
    garden.getByText("1 growth point", { exact: true }),
  ])
    await expectTextContrast(sample);
  for (const control of [
    create,
    page.getByRole("button", { name: "Archive Read", exact: true }),
  ]) {
    const bounds = await control.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
  const motion = await page.locator("main *").evaluateAll((elements) =>
    elements.every((element) => {
      const style = getComputedStyle(element);
      return (
        style.animationDuration
          .split(",")
          .every((duration) => parseFloat(duration) === 0) &&
        style.transitionDuration
          .split(",")
          .every((duration) => parseFloat(duration) === 0)
      );
    }),
  );
  expect(motion).toBe(true);
  await page.setViewportSize({ width: 1280, height: 1000 });
  await expectFitsViewport(page);
  await page.reload();
  await expect(
    page.getByText("1 lifetime completion", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: longestTitle, exact: true }),
  ).toHaveCount(0);
});
