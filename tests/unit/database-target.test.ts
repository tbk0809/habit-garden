import { describe, expect, it } from "vitest";
import { assertLocalDatabaseTarget } from "../../src/shared/server/db/local-target.ts";

describe("local database guard", () => {
  it("permits only explicit loopback development seed and isolated test targets", () => {
    expect(() =>
      assertLocalDatabaseTarget(
        "postgresql://owner:secret@127.0.0.1:55434/habit_garden_dev",
        "development",
        "seed",
      ),
    ).not.toThrow();
    expect(() =>
      assertLocalDatabaseTarget(
        "postgresql://owner:secret@localhost:55433/habit_garden_test",
        "test",
        "test",
      ),
    ).not.toThrow();
  });
  it.each([
    "postgresql://owner:secret@example.com/habit_garden_dev",
    "postgresql://owner:secret@127.0.0.1/habit_garden_test",
    "postgresql://owner:secret@127.0.0.1/habit_garden_dev?host=remote",
    "postgresql://owner:secret@127.0.0.1/habit_garden_dev#anything",
    "postgresql://owner@127.0.0.1/habit_garden_dev",
    "postgresql://owner:secret@127.0.0.1/other",
    "postgresql://owner:secret@127.0.0.1/habit_garden_dev/extra",
    "postgresql://owner:secret@127.0.0.1/%68abit_garden_dev",
    "not-a-url",
    "",
    undefined,
  ])(
    "rejects hosted, ambiguous and unintended seed targets without credentials in error",
    (url) => {
      expect(() =>
        assertLocalDatabaseTarget(url, "development", "seed"),
      ).toThrow("Local database target refused.");
    },
  );
  it("refuses missing or production environment and development targets for tests", () => {
    for (const environment of [undefined, "production", ""]) {
      expect(() =>
        assertLocalDatabaseTarget(
          "postgresql://owner:secret@localhost/habit_garden_dev",
          environment,
          "seed",
        ),
      ).toThrow();
    }
    expect(() =>
      assertLocalDatabaseTarget(
        "postgresql://owner:secret@localhost/habit_garden_dev",
        "test",
        "test",
      ),
    ).toThrow();
  });
});
