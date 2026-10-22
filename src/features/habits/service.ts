import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { habits, habitStreaks, users } from "../../db/schema/index.ts";
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
import { archiveHabitCommand, createHabitCommand } from "./input.ts";

export type CreateHabitSuccess = Readonly<{
  habitId: string;
  dashboard: DashboardDTO;
}>;
export type ArchiveHabitSuccess = Readonly<{
  habitId: string;
  status: "archived" | "already_archived";
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
