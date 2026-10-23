import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import { resolveBuildSource } from "./src/shared/server/build-source.ts";

export default function nextConfig(phase: string): NextConfig {
  let source;
  try {
    source = resolveBuildSource({
      cwd: import.meta.dirname,
      sourceSha:
        phase === PHASE_PRODUCTION_BUILD
          ? process.env.HABIT_GARDEN_BUILD_SOURCE_SHA
          : undefined,
    });
  } catch (error) {
    if (phase === PHASE_PRODUCTION_BUILD) throw error;
    source = { sourceSha: "unknown", sourceDirty: true };
  }

  return {
    turbopack: { root: import.meta.dirname },
    env: {
      HABIT_GARDEN_BUILD_SOURCE_SHA: source.sourceSha,
      HABIT_GARDEN_BUILD_SOURCE_DIRTY: String(source.sourceDirty),
    },
  };
}
