#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Prefer the reviewed local runtime on Windows. Ubuntu CI supplies this patch
# through its pinned runtime setup, and must pass the same exact-version check.
if [[ -f .tools/node-v24.22.1-win-x64/node.exe ]]; then
  export PATH="$PWD/.tools/node-v24.22.1-win-x64:$PATH"
fi

for tool in node npm git docker; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'Gate prerequisite missing: %s.\n' "$tool" >&2
    exit 1
  fi
done
if [[ "$(node --version)" != v24.22.1 ]]; then
  printf 'Gate requires Node v24.22.1.\n' >&2
  exit 1
fi
if [[ ! -f .env.test ]]; then
  printf 'Gate requires the isolated local .env.test configuration.\n' >&2
  exit 1
fi

NODE_ENV=test node --env-file=.env.test --input-type=module <<'NODE'
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { assertLocalDatabaseTarget } from "./src/shared/server/db/local-target.ts";

const fail = (message) => {
  console.error(`Gate prerequisite failed: ${message}.`);
  process.exit(1);
};
try {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  if (packageJson.engines?.node !== "24.22.1") fail("pinned Node contract");
  for (const path of ["package-lock.json", "scripts/integration.ts", "scripts/build.ts", "scripts/e2e.ts", "playwright.config.ts"])
    if (!existsSync(path)) fail("required source or lockfile");
  const require = createRequire(join(process.cwd(), "package.json"));
  for (const dependency of ["next", "pg", "next-auth", "drizzle-orm", "zod", "@playwright/test", "typescript", "vitest", "prettier", "eslint"])
    require.resolve(dependency);
  const hasSuite = (directory, suffix) =>
    existsSync(directory) && readdirSync(directory, { withFileTypes: true }).some((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory()
        ? hasSuite(path, suffix)
        : entry.name.endsWith(suffix) && readFileSync(path, "utf8").trim().length > 0;
    });
  for (const [directory, suffix] of [["tests/unit", ".test.ts"], ["tests/integration", ".test.ts"], ["tests/e2e", ".spec.ts"]])
    if (!hasSuite(directory, suffix)) fail("required meaningful suite");
  for (const target of ["format:check", "lint", "typecheck", "test:unit", "test:integration", "build", "test:e2e"]) {
    const command = packageJson.scripts?.[target];
    if (typeof command !== "string" || !command.trim() || /not-ready|passWithNoTests|--pass-with-no-tests/.test(command))
      fail("required real package target");
  }
  assertLocalDatabaseTarget(process.env.TEST_DATABASE_URL, "test", "test");
  assertLocalDatabaseTarget(process.env.TEST_RUNTIME_DATABASE_URL, "test", "test");
  const admin = new URL(process.env.TEST_DATABASE_URL);
  const runtime = new URL(process.env.TEST_RUNTIME_DATABASE_URL);
  if (admin.host !== runtime.host || admin.username !== "habit_garden_migrator" || runtime.username !== "habit_garden_runtime")
    fail("exact isolated database roles and target");
  const docker = spawnSync("docker", ["info"], { stdio: "ignore", timeout: 10000 });
  if (docker.status !== 0) fail("usable local Docker engine");
} catch {
  fail("installed dependencies and safe isolated configuration");
}
NODE

npm run format:check
npm run lint
npm run typecheck
npm run test:unit
# The existing guarded runner alone owns the fresh test-schema reset/migration.
NODE_ENV=test npm run test:integration
npm run build
NODE_ENV=test npm run test:e2e
