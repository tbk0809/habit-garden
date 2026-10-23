import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveBuildSource } from "../../src/shared/server/build-source.ts";
import { credentialFreeBuildEnv } from "../../scripts/build.ts";

const directories: string[] = [];

function directory() {
  const path = mkdtempSync(join(tmpdir(), "habit-garden-build-"));
  directories.push(path);
  return path;
}

function checkout() {
  const cwd = directory();
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "--quiet");
  git("config", "user.name", "Local fixture");
  git("config", "user.email", "fixture@example.invalid");
  writeFileSync(join(cwd, "source.txt"), "committed fixture\n");
  git("add", "source.txt");
  git("-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture");
  return { cwd, sha: git("rev-parse", "HEAD") };
}

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true });
});

describe("build source identity", () => {
  it("derives the full committed revision and reports tracked or untracked work", () => {
    const { cwd, sha } = checkout();
    expect(resolveBuildSource({ cwd })).toEqual({
      sourceSha: sha,
      sourceDirty: false,
    });
    writeFileSync(join(cwd, "source.txt"), "changed fixture\n");
    expect(resolveBuildSource({ cwd })).toEqual({
      sourceSha: sha,
      sourceDirty: true,
    });
    writeFileSync(join(cwd, "source.txt"), "committed fixture\n");
    writeFileSync(join(cwd, "untracked.txt"), "new fixture\n");
    expect(resolveBuildSource({ cwd })).toEqual({
      sourceSha: sha,
      sourceDirty: true,
    });
  });

  it("refuses an explicit identity that disagrees with the checkout", () => {
    const { cwd } = checkout();
    expect(() =>
      resolveBuildSource({ cwd, sourceSha: "a".repeat(40) }),
    ).toThrow("Build source identity does not match the checkout.");
  });

  it.each([
    undefined,
    "unknown",
    "a".repeat(7),
    "g".repeat(40),
    "0".repeat(40),
    " a".repeat(20),
  ])(
    "refuses missing or malformed identity outside a checkout (%s)",
    (sourceSha) => {
      expect(() => resolveBuildSource({ cwd: directory(), sourceSha })).toThrow(
        "Build source identity is unavailable.",
      );
    },
  );

  it("accepts a full explicit build identity when the source export has no git metadata", () => {
    expect(
      resolveBuildSource({ cwd: directory(), sourceSha: "b".repeat(40) }),
    ).toEqual({
      sourceSha: "b".repeat(40),
      sourceDirty: false,
    });
  });
});

it("build child receives empty credentials so Next cannot recover them from local env files", () => {
  const parent = {
    DATABASE_URL: "private-database",
    AUTH_SECRET: "private-secret",
    AUTH_GITHUB_ID: "private-client",
    AUTH_GITHUB_SECRET: "private-client-secret",
    AUTH_URL: "private-origin",
    PATH: "retained-path",
    NODE_ENV: "test",
  } satisfies NodeJS.ProcessEnv;
  const child = credentialFreeBuildEnv(parent);
  expect(child).toEqual({
    DATABASE_URL: "",
    AUTH_SECRET: "",
    AUTH_GITHUB_ID: "",
    AUTH_GITHUB_SECRET: "",
    AUTH_URL: "",
    PATH: "retained-path",
    NODE_ENV: "production",
  });
  expect(parent.AUTH_SECRET).toBe("private-secret");
});
