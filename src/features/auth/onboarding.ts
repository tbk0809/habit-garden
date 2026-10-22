import "server-only";
import { eq, sql } from "drizzle-orm";
import { users, gardenState, userPlants } from "../../db/schema/index.ts";
import type { Database } from "../../shared/server/db/types.ts";
import type { DashboardDTO } from "../../shared/domain/dashboard.ts";
import type { ActionResult } from "../../shared/domain/errors.ts";
import { ApplicationError } from "../../shared/domain/errors.ts";
import { safeFailure } from "../../shared/server/result.ts";
import { sessionScope } from "./session-scope.ts";
import { timeZoneCommand } from "./input.ts";
import { readDashboardSnapshot } from "../dashboard/read.ts";

export type OnboardingSuccess = Readonly<{
  status: "initialized" | "already_initialized";
  dashboard: DashboardDTO;
}>;

export async function confirmTimeZoneForSession(
  db: Database,
  session: unknown,
  input: unknown,
): Promise<ActionResult<OnboardingSuccess>> {
  try {
    const scope = sessionScope(session);
    const parsed = timeZoneCommand.safeParse(input);
    if (!parsed.success) throw new ApplicationError("VALIDATION_ERROR");
    const timeZone = parsed.data.timeZone;
    const data = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({
          timeZone: users.timeZone,
          initializedAt: users.initializedAt,
        })
        .from(users)
        .where(eq(users.id, scope.userId))
        .for("update");
      if (!user) throw new ApplicationError("UNAUTHENTICATED");
      const supported = await tx.execute(
        sql`select exists(select 1 from pg_timezone_names where name=${timeZone}) as supported`,
      );
      if (supported.rows[0]?.supported !== true)
        throw new ApplicationError("VALIDATION_ERROR");
      if (user.timeZone !== null) {
        if (user.timeZone !== timeZone)
          throw new ApplicationError("TIME_ZONE_FIXED");
        return {
          status: "already_initialized" as const,
          dashboard: await readDashboardSnapshot(tx, scope),
        };
      }
      // Unexpected retained state is an invariant failure, never permission to repair.
      const existing = await tx.execute(
        sql`select exists(select 1 from garden_state where user_id=${scope.userId}) or exists(select 1 from user_plants where user_id=${scope.userId}) or exists(select 1 from habits where user_id=${scope.userId}) as present`,
      );
      if (existing.rows[0]?.present !== false || user.initializedAt !== null)
        throw new ApplicationError("SERVICE_UNAVAILABLE");
      const instant = await tx.execute(
        sql`select clock_timestamp() as instant`,
      );
      const rawInstant = instant.rows[0]?.instant;
      // Drizzle raw execute preserves timestamptz as a string; mapped columns use Date.
      const asOf =
        typeof rawInstant === "string" ? new Date(rawInstant) : rawInstant;
      if (!(asOf instanceof Date) || !Number.isFinite(asOf.getTime()))
        throw new ApplicationError("SERVICE_UNAVAILABLE");
      await tx
        .update(users)
        .set({ timeZone, initializedAt: asOf })
        .where(eq(users.id, scope.userId));
      await tx.insert(gardenState).values({
        userId: scope.userId,
        lifetimeCompletionCount: 0,
        updatedAt: asOf,
      });
      await tx
        .insert(userPlants)
        .values({ userId: scope.userId, plantId: "clover", unlockedAt: asOf });
      return {
        status: "initialized" as const,
        dashboard: await readDashboardSnapshot(tx, scope, asOf),
      };
    });
    return { ok: true, data };
  } catch (error) {
    return safeFailure(error);
  }
}
