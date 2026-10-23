import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type BuildSource = Readonly<{
  sourceSha: string;
  sourceDirty: boolean;
}>;

export function resolveBuildSource(input: {
  cwd: string;
  sourceSha?: string;
}): BuildSource {
  if (
    input.sourceSha !== undefined &&
    (!/^[0-9a-f]{40}$/.test(input.sourceSha) || /^0{40}$/.test(input.sourceSha))
  )
    throw new Error("Build source identity is unavailable.");
  // Never borrow an unrelated ancestor repository's identity for an export.
  if (!existsSync(join(input.cwd, ".git"))) {
    if (input.sourceSha)
      return { sourceSha: input.sourceSha, sourceDirty: false };
    throw new Error("Build source identity is unavailable.");
  }

  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: input.cwd,
      encoding: "utf8",
      stdio: "pipe",
      timeout: 5000,
    }).trim();
  let checkoutSha: string;
  try {
    checkoutSha = git("rev-parse", "--verify", "HEAD");
  } catch {
    throw new Error("Build source identity is unavailable.");
  }
  if (!/^[0-9a-f]{40}$/.test(checkoutSha))
    throw new Error("Build source identity is unavailable.");
  if (input.sourceSha && input.sourceSha !== checkoutSha)
    throw new Error("Build source identity does not match the checkout.");
  try {
    return {
      sourceSha: checkoutSha,
      sourceDirty:
        git("status", "--porcelain", "--untracked-files=normal") !== "",
    };
  } catch {
    throw new Error("Build source identity is unavailable.");
  }
}
