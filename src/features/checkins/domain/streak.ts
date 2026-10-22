import {
  civilDaysBetween,
  type CivilDate,
} from "../../../shared/domain/civil-date.ts";

export type StreakState = Readonly<{
  runLength: number;
  bestStreak: number;
  lastCompletedOn: CivilDate | null;
}>;

export function guardExpectedDate(
  expected: CivilDate,
  authoritative: CivilDate,
): Readonly<{ ok: true } | { ok: false; code: "DAY_ROLLED_OVER" }> {
  return expected === authoritative
    ? { ok: true }
    : { ok: false, code: "DAY_ROLLED_OVER" };
}

type StreakTransition = Readonly<
  | { ok: true; streak: StreakState }
  | { ok: false; code: "DUPLICATE_DATE" | "DATE_ORDER_INVALID" }
>;

export function advanceStreak(
  previous: StreakState,
  acceptedDate: CivilDate,
): StreakTransition {
  assertStreak(previous);
  const gap =
    previous.lastCompletedOn === null
      ? null
      : civilDaysBetween(previous.lastCompletedOn, acceptedDate);
  if (gap === 0) return { ok: false, code: "DUPLICATE_DATE" };
  if (gap !== null && gap < 0) return { ok: false, code: "DATE_ORDER_INVALID" };

  const runLength = gap === 1 ? previous.runLength + 1 : 1;
  return {
    ok: true,
    streak: {
      runLength,
      bestStreak: Math.max(previous.bestStreak, runLength),
      lastCompletedOn: acceptedDate,
    },
  };
}

export function projectCurrentStreak(
  streak: StreakState,
  asOfDate: CivilDate,
): number {
  assertStreak(streak);
  if (streak.lastCompletedOn === null) return 0;
  const gap = civilDaysBetween(streak.lastCompletedOn, asOfDate);
  if (gap < 0)
    throw new RangeError(
      "Retained completion is later than the authoritative date.",
    );
  return gap <= 1 ? streak.runLength : 0;
}

function assertStreak(streak: StreakState): void {
  if (
    !Number.isSafeInteger(streak.runLength) ||
    !Number.isSafeInteger(streak.bestStreak) ||
    streak.runLength < 0 ||
    streak.bestStreak < streak.runLength ||
    (streak.lastCompletedOn === null
      ? streak.runLength !== 0 || streak.bestStreak !== 0
      : streak.runLength < 1)
  ) {
    throw new RangeError("Retained streak state is inconsistent.");
  }
}
