import { expect, test } from "vitest";
import { allowsAuthRequest } from "../../src/features/auth/origin";

test("allows canonical-origin callbacks and form posts", () => {
  expect(
    allowsAuthRequest(
      new Request("https://garden.example/api/auth/callback/github"),
      "https://garden.example",
    ),
  ).toBe(true);
  expect(
    allowsAuthRequest(
      new Request("https://garden.example/api/auth/signout", {
        method: "POST",
        headers: { Origin: "https://garden.example" },
      }),
      "https://garden.example",
    ),
  ).toBe(true);
});
test.each([
  new Request("https://evil.example/api/auth/session"),
  new Request("https://garden.example/api/auth/signout", {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  }),
])("refuses a spoofed host or cross-origin form post", (request) => {
  expect(allowsAuthRequest(request, "https://garden.example")).toBe(false);
});
