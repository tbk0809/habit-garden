import { describe, expect, it } from "vitest";
import { civilDate } from "../../src/shared/domain/civil-date";
import {
  advanceStreak,
  guardExpectedDate,
  projectCurrentStreak,
  type StreakState,
} from "../../src/features/checkins/domain/streak";

describe("guardExpectedDate", () => {
  it("allows the server-issued date only while it remains current", () => {
    expect(
      guardExpectedDate(civilDate("2026-10-22"), civilDate("2026-10-22")),
    ).toEqual({ ok: true });
  });

  it.each(["2026-10-21", "2026-10-23"])(
    "rejects %s instead of authorizing a different completion day",
    (date) => {
      expect(
        guardExpectedDate(civilDate(date), civilDate("2026-10-22")),
      ).toEqual({ ok: false, code: "DAY_ROLLED_OVER" });
    },
  );
});

describe("advanceStreak", () => {
  it("starts the first run and best streak at one without mutating the empty history", () => {
    const previous: StreakState = Object.freeze({
      runLength: 0,
      bestStreak: 0,
      lastCompletedOn: null,
    });
    expect(advanceStreak(previous, civilDate("2026-10-22"))).toEqual({
      ok: true,
      streak: { runLength: 1, bestStreak: 1, lastCompletedOn: "2026-10-22" },
    });
    expect(previous).toEqual({
      runLength: 0,
      bestStreak: 0,
      lastCompletedOn: null,
    });
  });

  it.each([
    ["2026-10-21", "2026-10-22"],
    ["2026-01-31", "2026-02-01"],
    ["2026-12-31", "2027-01-01"],
    ["2024-02-28", "2024-02-29"],
    ["2024-02-29", "2024-03-01"],
    ["1900-02-28", "1900-03-01"],
    ["2000-02-28", "2000-02-29"],
    ["2026-03-08", "2026-03-09"],
    ["2026-11-01", "2026-11-02"],
  ])(
    "extends consecutive civil days %s → %s, including calendar and DST boundaries",
    (previousDate, acceptedDate) => {
      const previous: StreakState = Object.freeze({
        runLength: 4,
        bestStreak: 4,
        lastCompletedOn: civilDate(previousDate),
      });
      expect(advanceStreak(previous, civilDate(acceptedDate))).toEqual({
        ok: true,
        streak: { runLength: 5, bestStreak: 5, lastCompletedOn: acceptedDate },
      });
      expect(previous.runLength).toBe(4);
    },
  );

  it("preserves a longer best streak when a consecutive run has not caught it", () => {
    expect(
      advanceStreak(
        {
          runLength: 2,
          bestStreak: 9,
          lastCompletedOn: civilDate("2026-10-21"),
        },
        civilDate("2026-10-22"),
      ),
    ).toEqual({
      ok: true,
      streak: { runLength: 3, bestStreak: 9, lastCompletedOn: "2026-10-22" },
    });
  });

  it.each(["2026-10-20", "2025-12-31", "2024-02-29"])(
    "restarts after a missed date following %s and retains the best run",
    (previousDate) => {
      expect(
        advanceStreak(
          {
            runLength: 4,
            bestStreak: 8,
            lastCompletedOn: civilDate(previousDate),
          },
          civilDate("2026-10-22"),
        ),
      ).toEqual({
        ok: true,
        streak: { runLength: 1, bestStreak: 8, lastCompletedOn: "2026-10-22" },
      });
    },
  );

  it.each([
    ["2026-10-22", "DUPLICATE_DATE"],
    ["2026-10-21", "DATE_ORDER_INVALID"],
  ])(
    "returns %s's error %s without changing retained history",
    (date, code) => {
      const previous: StreakState = Object.freeze({
        runLength: 2,
        bestStreak: 9,
        lastCompletedOn: civilDate("2026-10-22"),
      });
      expect(advanceStreak(previous, civilDate(date))).toEqual({
        ok: false,
        code,
      });
      expect(previous).toEqual({
        runLength: 2,
        bestStreak: 9,
        lastCompletedOn: "2026-10-22",
      });
    },
  );

  it.each([
    { runLength: 1, bestStreak: 1, lastCompletedOn: null },
    { runLength: 0, bestStreak: 2, lastCompletedOn: null },
    { runLength: 0, bestStreak: 1, lastCompletedOn: civilDate("2026-10-21") },
    { runLength: 3, bestStreak: 2, lastCompletedOn: civilDate("2026-10-21") },
    { runLength: -1, bestStreak: 2, lastCompletedOn: civilDate("2026-10-21") },
    { runLength: 1.5, bestStreak: 2, lastCompletedOn: civilDate("2026-10-21") },
  ])("rejects inconsistent retained streak state %#", (previous) => {
    expect(() => advanceStreak(previous, civilDate("2026-10-22"))).toThrow(
      RangeError,
    );
    expect(() =>
      projectCurrentStreak(previous, civilDate("2026-10-22")),
    ).toThrow(RangeError);
  });
});

describe("projectCurrentStreak", () => {
  it("shows zero before the first completion", () => {
    expect(
      projectCurrentStreak(
        { runLength: 0, bestStreak: 0, lastCompletedOn: null },
        civilDate("2026-10-22"),
      ),
    ).toBe(0);
  });

  it.each([
    ["2026-10-22", 4],
    ["2026-10-21", 4],
    ["2026-10-20", 0],
    ["2025-10-22", 0],
  ])(
    "projects last completion %s as current streak %i on October 22",
    (lastDate, expected) => {
      const previous: StreakState = Object.freeze({
        runLength: 4,
        bestStreak: 9,
        lastCompletedOn: civilDate(lastDate),
      });
      expect(projectCurrentStreak(previous, civilDate("2026-10-22"))).toBe(
        expected,
      );
      expect(previous).toEqual({
        runLength: 4,
        bestStreak: 9,
        lastCompletedOn: lastDate,
      });
    },
  );

  it("keeps yesterday's run through a leap-day boundary", () => {
    expect(
      projectCurrentStreak(
        {
          runLength: 3,
          bestStreak: 3,
          lastCompletedOn: civilDate("2024-02-29"),
        },
        civilDate("2024-03-01"),
      ),
    ).toBe(3);
  });

  it("fails on future retained history instead of silently resetting it", () => {
    expect(() =>
      projectCurrentStreak(
        {
          runLength: 2,
          bestStreak: 3,
          lastCompletedOn: civilDate("2026-10-23"),
        },
        civilDate("2026-10-22"),
      ),
    ).toThrow(RangeError);
  });
});
