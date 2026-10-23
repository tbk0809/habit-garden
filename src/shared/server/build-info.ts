// Next replaces these direct references with literals from next.config at build.
// Do not replace them with a runtime env object lookup.
export const buildInfo = Object.freeze({
  sourceSha: process.env.HABIT_GARDEN_BUILD_SOURCE_SHA ?? "unknown",
  sourceDirty: process.env.HABIT_GARDEN_BUILD_SOURCE_DIRTY !== "false",
});
