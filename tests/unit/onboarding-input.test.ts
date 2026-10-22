import { expect, test } from "vitest";
import { timeZoneCommand } from "../../src/features/auth/input";

test("accepts a recognized IANA timezone only after explicit command submission", () => {
  expect(
    timeZoneCommand.safeParse({ timeZone: "Asia/Kuala_Lumpur" }).success,
  ).toBe(true);
  expect(timeZoneCommand.safeParse({ timeZone: "UTC" }).success).toBe(true);
});

test.each([
  null,
  {},
  { timeZone: "" },
  { timeZone: "+08:00" },
  { timeZone: "Mars/Olympus" },
  { timeZone: " Asia/Tokyo" },
  { timeZone: "Asia/Tokyo", userId: "forged" },
])("rejects malformed or client-authority fields %j", (input) => {
  expect(timeZoneCommand.safeParse(input).success).toBe(false);
});
