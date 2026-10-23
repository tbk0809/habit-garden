import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolveBuildSource } from "../src/shared/server/build-source.ts";

export function credentialFreeBuildEnv(
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  // Empty values prevent Next's env loader from restoring .env.local secrets.
  return {
    ...environment,
    NODE_ENV: "production",
    DATABASE_URL: "",
    AUTH_SECRET: "",
    AUTH_GITHUB_ID: "",
    AUTH_GITHUB_SECRET: "",
    AUTH_URL: "",
  };
}

if (import.meta.main) {
  try {
    const cwd = fileURLToPath(new URL("..", import.meta.url));
    const source = resolveBuildSource({
      cwd,
      sourceSha: process.env.HABIT_GARDEN_BUILD_SOURCE_SHA,
    });
    console.info(
      `Building source ${source.sourceSha}; dirty checkout: ${source.sourceDirty}.`,
    );
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("../node_modules/next/dist/bin/next", import.meta.url),
        ),
        "build",
      ],
      {
        cwd,
        stdio: "inherit",
        env: {
          ...credentialFreeBuildEnv(process.env),
          HABIT_GARDEN_BUILD_SOURCE_SHA: source.sourceSha,
        },
      },
    );
    process.exitCode = result.status ?? 1;
  } catch {
    console.error("Build refused: verified source identity is required.");
    process.exitCode = 1;
  }
}
