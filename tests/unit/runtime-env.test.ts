import { describe, expect, it } from "vitest";
import { parseRuntimeEnv } from "../../src/shared/server/runtime-env-schema";

const valid = {
  DATABASE_URL:
    "postgresql://fixture_user:fixture_password@127.0.0.1:5432/habit_garden_test",
  AUTH_SECRET: "fictional-test-secret-with-at-least-32-characters",
  AUTH_GITHUB_ID: "fictional-client-id",
  AUTH_GITHUB_SECRET: "fictional-client-secret",
};

describe("parseRuntimeEnv", () => {
  it("validates runtime configuration without opening a database connection", () => {
    expect(parseRuntimeEnv(valid)).toEqual(valid);
  });

  it.each([
    {},
    { ...valid, DATABASE_URL: "https://example.com/database" },
    { ...valid, DATABASE_URL: "not-a-url" },
    { ...valid, DATABASE_URL: "postgresql://localhost/database" },
    { ...valid, AUTH_SECRET: "short" },
    { ...valid, AUTH_GITHUB_ID: "" },
    { ...valid, AUTH_GITHUB_SECRET: " " },
    { ...valid, AUTH_GITHUB_ID: "replace_with_github_oauth_client_id" },
  ])(
    "fails closed with a safe error on invalid runtime configuration %#",
    (input) => {
      expect(() => parseRuntimeEnv(input)).toThrow(
        "Runtime configuration is unavailable.",
      );
    },
  );

  it("does not include credential values in an error", () => {
    const credential = "private-fixture";
    expect(() =>
      parseRuntimeEnv({ ...valid, AUTH_SECRET: credential }),
    ).toThrow(/^Runtime configuration is unavailable\.$/);
  });
});
