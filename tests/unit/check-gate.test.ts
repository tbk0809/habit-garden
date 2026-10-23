import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const directories: string[] = [];
const stages = [
  "format:check",
  "lint",
  "typecheck",
  "test:unit",
  "test:integration",
  "build",
  "test:e2e",
];

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "habit-garden-gate-"));
  directories.push(cwd);
  const copy = (source: string, target = source) => {
    mkdirSync(dirname(join(cwd, target)), { recursive: true });
    copyFileSync(join(root, source), join(cwd, target));
  };
  copy("check.sh");
  for (const path of [
    "scripts/integration.ts",
    "scripts/build.ts",
    "scripts/e2e.ts",
    "playwright.config.ts",
    "package-lock.json",
    "src/shared/server/db/local-target.ts",
    "tests/unit/civil-date.test.ts",
    "tests/integration/onboarding.test.ts",
    "tests/e2e/garden.spec.ts",
  ])
    copy(path);
  symlinkSync(
    join(root, "node_modules"),
    join(cwd, "node_modules"),
    "junction",
  );
  const packageJson = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  packageJson.scripts.build = "node scripts/build.ts";
  packageJson.scripts["test:e2e"] = "node --env-file=.env.test scripts/e2e.ts";
  writeFileSync(join(cwd, "package.json"), JSON.stringify(packageJson));
  writeFileSync(
    join(cwd, ".env.test"),
    "TEST_DATABASE_URL=postgresql://habit_garden_migrator:fixture@127.0.0.1:5432/habit_garden_test\nTEST_RUNTIME_DATABASE_URL=postgresql://habit_garden_runtime:fixture@127.0.0.1:5432/habit_garden_test\n",
  );
  const bin = join(cwd, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "npm"),
    '#!/usr/bin/env node\nimport {appendFileSync} from "node:fs";const stage=process.argv[3];appendFileSync(process.env.GATE_LOG,stage+"\\n");process.exit(stage===process.env.GATE_FAIL_STAGE?17:0);\n',
    { mode: 0o755 },
  );
  writeFileSync(
    join(bin, "docker"),
    "#!/usr/bin/env node\nprocess.exit(0);\n",
    {
      mode: 0o755,
    },
  );
  if (process.platform === "win32") {
    // Node's direct spawn resolves .exe on Windows rather than shell scripts.
    copyFileSync(process.execPath, join(bin, "docker.exe"));
    writeFileSync(join(cwd, "info"), "process.exit(0);\n");
  }
  const log = join(cwd, "gate.log");
  writeFileSync(log, "");
  return {
    cwd,
    run(failStage = "") {
      const bash =
        process.platform === "win32"
          ? join(
              process.env.ProgramFiles ?? "C:/Program Files",
              "Git/bin/bash.exe",
            )
          : "bash";
      const result = spawnSync(bash, ["check.sh"], {
        cwd,
        encoding: "utf8",
        timeout: 30000,
        env: {
          ...process.env,
          PATH: [bin, dirname(process.execPath), process.env.PATH].join(
            delimiter,
          ),
          GATE_LOG: log,
          GATE_FAIL_STAGE: failStage,
          TEST_DATABASE_URL:
            "postgresql://habit_garden_migrator:fixture@127.0.0.1:5432/habit_garden_test",
          TEST_RUNTIME_DATABASE_URL:
            "postgresql://habit_garden_runtime:fixture@127.0.0.1:5432/habit_garden_test",
        },
      });
      return {
        ...result,
        stages: readFileSync(log, "utf8").trim().split("\n").filter(Boolean),
      };
    },
  };
}

afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true });
});

it("executes each real gate target in the approved order", () => {
  const result = fixture().run();
  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(result.stages).toEqual(stages);
});

it("preserves the failing exit code and never starts a later gate", () => {
  const result = fixture().run("lint");
  expect(result.status).toBe(17);
  expect(result.stages).toEqual(["format:check", "lint"]);
});

it("fails before running gates when a required suite is absent", () => {
  const target = fixture();
  rmSync(join(target.cwd, "tests/e2e"), { recursive: true });
  const result = target.run();
  expect(result.status).not.toBe(0);
  expect(result.stages).toEqual([]);
});

it("refuses a different Node version before invoking any package target", () => {
  const target = fixture();
  writeFileSync(
    join(target.cwd, "bin/node"),
    "#!/usr/bin/env bash\nprintf 'v0.0.0\\n'\n",
    { mode: 0o755 },
  );
  const result = target.run();
  expect(result.status).not.toBe(0);
  expect(result.stages).toEqual([]);
});
