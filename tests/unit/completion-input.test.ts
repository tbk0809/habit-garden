import { describe, expect, it } from "vitest";
import * as input from "../../src/features/habits/input.ts";

describe("completion command", () => {
  it("accepts only a habit UUID and an actual civil date precondition", () => {
    expect(input).toHaveProperty("completeHabitCommand");
    const schema = input.completeHabitCommand;
    const valid = {
      habitId: "8fc932c1-ab0d-43c1-b01e-7300036207c4",
      expectedLocalDate: "2028-02-29",
    };
    expect(schema.safeParse(valid).success).toBe(true);
    for (const command of [
      null,
      {},
      { ...valid, habitId: "bad" },
      { ...valid, expectedLocalDate: "2026-02-29" },
      { ...valid, expectedLocalDate: "2026-4-01" },
      { ...valid, expectedLocalDate: "0000-01-01" },
      { ...valid, expectedLocalDate: "2026-13-01" },
      { ...valid, userId: valid.habitId },
      { ...valid, asOf: "2026-10-23" },
      { ...valid, count: 12 },
    ]) {
      expect(schema.safeParse(command).success).toBe(false);
    }
  });
});
