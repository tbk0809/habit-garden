import { expect, test } from "vitest";
import { sessionScope } from "../../src/features/auth/session-scope";

const id = "81000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-22T10:00:00Z");

test("uses only the valid unexpired session's UUID as the owner scope", () => {
  expect(
    sessionScope({ user: { id }, expires: "2026-10-22T10:00:01Z" }, now),
  ).toEqual({ userId: id });
});

test.each([
  null,
  {},
  { user: { id }, expires: "2026-10-22T10:00:00Z" },
  { user: { id }, expires: "2026-10-21T10:00:00Z" },
  { user: { id }, expires: "invalid" },
  { user: { id: "forged" }, expires: "2027-01-01T00:00:00Z" },
  { userId: id, expires: "2027-01-01T00:00:00Z" },
])("refuses absent, malformed, or expired session %j", (session) => {
  expect(() => sessionScope(session, now)).toThrow("UNAUTHENTICATED");
});
