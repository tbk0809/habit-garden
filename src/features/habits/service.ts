import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  habits,
  habitStreaks,
  users,
  habitLogs,
  gardenState,
  plantCatalog,
  userPlants,
} from "../../db/schema/index.ts";
import { civilDate, type CivilDate } from "../../shared/domain/civil-date.ts";
import { advanceStreak, guardExpectedDate } from "../checkins/domain/streak.ts";
import {
  advanceGarden,
  type PlantId,
  type SlotIndex,
} from "../garden/domain/growth.ts";
import type { Database, Transaction } from "../../shared/server/db/types.ts";
import type { DashboardDTO } from "../../shared/domain/dashboard.ts";
import {
  ApplicationError,
  type ActionResult,
} from "../../shared/domain/errors.ts";
import { safeFailure } from "../../shared/server/result.ts";
import {
  sessionScope,
  type AuthenticatedScope,
} from "../auth/session-scope.ts";
import { readDashboardSnapshot } from "../dashboard/read.ts";
import {
  archiveHabitCommand,
  createHabitCommand,
  completeHabitCommand,
} from "./input.ts";

export type CreateHabitSuccess = Readonly<{
  habitId: string;
  dashboard: DashboardDTO;
}>;
export type ArchiveHabitSuccess = Readonly<{
  habitId: string;
  status: "archived" | "already_archived";
  dashboard: DashboardDTO;
}>;
export type CompleteHabitSuccess = Readonly<{
  habitId: string;
  status: "completed" | "already_completed";
  dashboard: DashboardDTO;
}>;

async function lockInitializedUser(tx: Transaction, scope: AuthenticatedScope) {
  const [user] = await tx
    .select({ timeZone: users.timeZone, initializedAt: users.initializedAt })
    .from(users)
    .where(eq(users.id, scope.userId))
    .for("update");
  if (!user) throw new ApplicationError("UNAUTHENTICATED");
  if (user.timeZone === null || user.initializedAt === null)
    throw new ApplicationError("ONBOARDING_REQUIRED");
  return user;
}

async function mutationInstant(tx: Transaction): Promise<Date> {
  const result = await tx.execute(sql`select clock_timestamp() as instant`);
  const raw = result.rows[0]?.instant;
  const instant = typeof raw === "string" ? new Date(raw) : raw;
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime()))
    throw new ApplicationError("SERVICE_UNAVAILABLE");
  return instant;
}

// The branded scope is derived only at a trusted server boundary, never from input.
export async function createHabit(
  db: Database,
  scope: AuthenticatedScope,
  command: Readonly<{ title: string }>,
): Promise<CreateHabitSuccess> {
  return db.transaction(async (tx) => {
    await lockInitializedUser(tx, scope);
    const [active] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(habits)
      .where(and(eq(habits.userId, scope.userId), isNull(habits.archivedAt)));
    if (!active || !Number.isInteger(active.count))
      throw new ApplicationError("SERVICE_UNAVAILABLE");
    if (active.count >= 10) throw new ApplicationError("LIMIT_REACHED");
    const asOf = await mutationInstant(tx);
    const habitId = randomUUID();
    await tx.insert(habits).values({
      id: habitId,
      userId: scope.userId,
      title: command.title,
      createdAt: asOf,
      updatedAt: asOf,
    });
    await tx.insert(habitStreaks).values({
      habitId,
      userId: scope.userId,
      runLength: 0,
      longestStreak: 0,
      lastCompletedOn: null,
    });
    return { habitId, dashboard: await readDashboardSnapshot(tx, scope, asOf) };
  });
}

export async function archiveHabit(
  db: Database,
  scope: AuthenticatedScope,
  command: Readonly<{ habitId: string }>,
): Promise<ArchiveHabitSuccess> {
  return db.transaction(async (tx) => {
    await lockInitializedUser(tx, scope);
    const owned = and(
      eq(habits.id, command.habitId),
      eq(habits.userId, scope.userId),
    );
    const [habit] = await tx
      .select({ archivedAt: habits.archivedAt })
      .from(habits)
      .where(owned)
      .for("update");
    if (!habit) throw new ApplicationError("NOT_FOUND");
    const asOf = await mutationInstant(tx);
    const status =
      habit.archivedAt === null
        ? ("archived" as const)
        : ("already_archived" as const);
    if (status === "archived") {
      await tx
        .update(habits)
        .set({ archivedAt: asOf, updatedAt: asOf })
        .where(owned);
    }
    return {
      habitId: command.habitId,
      status,
      dashboard: await readDashboardSnapshot(tx, scope, asOf),
    };
  });
}

export async function completeHabit(
  db: Database,
  scope: AuthenticatedScope,
  command: Readonly<{ habitId: string; expectedLocalDate: CivilDate }>,
): Promise<CompleteHabitSuccess> {
  return db.transaction(
    async (tx) => {
      const user = await lockInitializedUser(tx, scope);
      const owned = and(
        eq(habits.id, command.habitId),
        eq(habits.userId, scope.userId),
      );
      const [habit] = await tx
        .select({ archivedAt: habits.archivedAt })
        .from(habits)
        .where(owned)
        .for("update");
      if (!habit) throw new ApplicationError("NOT_FOUND");
      // The clock statement runs only after both owned locks have been acquired.
      const asOf = await mutationInstant(tx);
      const date = await tx.execute(
        sql`select (${asOf}::timestamptz at time zone ${user.timeZone})::date::text as local_date`,
      );
      const localDate = civilDate(date.rows[0]?.local_date);
      if (!guardExpectedDate(command.expectedLocalDate, localDate).ok)
        throw new ApplicationError("DAY_ROLLED_OVER");
      const logOwner = and(
        eq(habitLogs.habitId, command.habitId),
        eq(habitLogs.userId, scope.userId),
        eq(habitLogs.localDate, localDate),
      );
      const [existing] = await tx
        .select({ habitId: habitLogs.habitId })
        .from(habitLogs)
        .where(logOwner);
      if (existing)
        return {
          habitId: command.habitId,
          status: "already_completed",
          dashboard: await readDashboardSnapshot(tx, scope, asOf),
        };
      if (habit.archivedAt !== null)
        throw new ApplicationError("HABIT_ARCHIVED");
      const inserted = await tx
        .insert(habitLogs)
        .values({
          habitId: command.habitId,
          userId: scope.userId,
          localDate,
          completedAt: asOf,
        })
        .returning({ habitId: habitLogs.habitId });
      if (inserted.length !== 1)
        throw new ApplicationError("SERVICE_UNAVAILABLE");
      const streakOwner = and(
        eq(habitStreaks.habitId, command.habitId),
        eq(habitStreaks.userId, scope.userId),
      );
      const [previous] = await tx
        .select()
        .from(habitStreaks)
        .where(streakOwner);
      const [garden] = await tx
        .select()
        .from(gardenState)
        .where(eq(gardenState.userId, scope.userId));
      if (!previous || !garden)
        throw new ApplicationError("SERVICE_UNAVAILABLE");
      const next = advanceStreak(
        {
          runLength: previous.runLength,
          bestStreak: previous.longestStreak,
          lastCompletedOn:
            previous.lastCompletedOn === null
              ? null
              : civilDate(previous.lastCompletedOn),
        },
        localDate,
      );
      if (!next.ok) throw new ApplicationError("SERVICE_UNAVAILABLE");
      const catalog = await tx
        .select({
          id: plantCatalog.id,
          slotIndex: plantCatalog.slotIndex,
          unlockAt: plantCatalog.unlockAt,
        })
        .from(plantCatalog);
      const growth = advanceGarden(
        garden.lifetimeCompletionCount,
        catalog.map((p) => ({
          ...p,
          id: p.id as PlantId,
          slotIndex: p.slotIndex as SlotIndex,
        })),
      );
      await tx
        .update(habitStreaks)
        .set({
          runLength: next.streak.runLength,
          longestStreak: next.streak.bestStreak,
          lastCompletedOn: next.streak.lastCompletedOn,
        })
        .where(streakOwner);
      await tx
        .update(gardenState)
        .set({ lifetimeCompletionCount: growth.nextTotal, updatedAt: asOf })
        .where(eq(gardenState.userId, scope.userId));
      if (growth.newlyEligiblePlantIds.length)
        await tx.insert(userPlants).values(
          growth.newlyEligiblePlantIds.map((plantId) => ({
            userId: scope.userId,
            plantId,
            unlockedAt: asOf,
          })),
        );
      return {
        habitId: command.habitId,
        status: "completed",
        dashboard: await readDashboardSnapshot(tx, scope, asOf),
      };
    },
    { isolationLevel: "read committed" },
  );
}

export async function completeHabitForSession(
  db: Database,
  session: unknown,
  input: unknown,
): Promise<ActionResult<CompleteHabitSuccess>> {
  try {
    const scope = sessionScope(session);
    const parsed = completeHabitCommand.safeParse(input);
    if (!parsed.success)
      throw new ApplicationError("VALIDATION_ERROR", {
        habitId: ["Refresh your habits and choose a valid completion."],
      });
    return { ok: true, data: await completeHabit(db, scope, parsed.data) };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function createHabitForSession(
  db: Database,
  session: unknown,
  input: unknown,
): Promise<ActionResult<CreateHabitSuccess>> {
  try {
    const scope = sessionScope(session);
    const parsed = createHabitCommand.safeParse(input);
    if (!parsed.success)
      throw new ApplicationError("VALIDATION_ERROR", {
        title: ["Use a title of 1–80 characters."],
      });
    return { ok: true, data: await createHabit(db, scope, parsed.data) };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function archiveHabitForSession(
  db: Database,
  session: unknown,
  input: unknown,
): Promise<ActionResult<ArchiveHabitSuccess>> {
  try {
    const scope = sessionScope(session);
    const parsed = archiveHabitCommand.safeParse(input);
    if (!parsed.success)
      throw new ApplicationError("VALIDATION_ERROR", {
        habitId: ["Choose a valid habit."],
      });
    return { ok: true, data: await archiveHabit(db, scope, parsed.data) };
  } catch (error) {
    return safeFailure(error);
  }
}
