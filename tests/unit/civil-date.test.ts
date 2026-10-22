import { describe, expect, it } from "vitest";
import { civilDate } from "../../src/shared/domain/civil-date";

describe("civilDate", () => {
  it.each([
    "2024-02-29",
    "2000-02-29",
    "2026-12-31",
    "0001-01-01",
    "9999-12-31",
  ])("accepts the real canonical date %s", (value) => {
    expect(civilDate(value)).toBe(value);
  });

  it.each([
    "2026-02-29",
    "1900-02-29",
    "2024-02-30",
    "2026-04-31",
    "2026-00-01",
    "2026-13-01",
    "2026-01-00",
    "2026-01-32",
    "0000-01-01",
    "2026-1-01",
    "26-01-01",
    "2026-01-01T00:00:00Z",
    " 2026-01-01",
    "2026-01-01\n",
    "",
    null,
    20260101,
  ])("rejects malformed or impossible calendar input %j", (value) => {
    expect(() => civilDate(value)).toThrow(TypeError);
  });
});
