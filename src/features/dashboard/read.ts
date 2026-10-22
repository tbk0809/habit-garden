import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { civilDate } from "../../shared/domain/civil-date.ts";
import type { DashboardDTO } from "../../shared/domain/dashboard.ts";
import { ApplicationError } from "../../shared/domain/errors.ts";
import type { QueryExecutor, Database } from "../../shared/server/db/types.ts";
import { projectCurrentStreak } from "../checkins/domain/streak.ts";
import { projectPlant, type CatalogPlant } from "../garden/domain/growth.ts";
import {
  sessionScope,
  type AuthenticatedScope,
} from "../auth/session-scope.ts";
import { safeFailure } from "../../shared/server/result.ts";
import type { ActionResult } from "../../shared/domain/errors.ts";

const nonnegative = z.number().int().nonnegative();
const snapshotSchema = z.object({
  as_of: z.union([z.date(), z.string()]).pipe(z.coerce.date()),
  local_date: z.string().nullable(),
  time_zone: z.string().nullable(),
  total: nonnegative.nullable(),
  retained: nonnegative,
  habits: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      completedToday: z.boolean(),
      runLength: nonnegative,
      bestStreak: nonnegative,
      lastCompletedOn: z.string().nullable(),
    }),
  ),
  plants: z.array(
    z.object({
      id: z.enum(["clover", "daisy", "sunflower", "cherry"]),
      slotIndex: z.union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
      ]),
      unlockAt: nonnegative,
      owned: z.boolean(),
    }),
  ),
});
const catalog = [
  { id: "clover", slotIndex: 0, unlockAt: 0 },
  { id: "daisy", slotIndex: 1, unlockAt: 5 },
  { id: "sunflower", slotIndex: 2, unlockAt: 15 },
  { id: "cherry", slotIndex: 3, unlockAt: 30 },
] as const satisfies readonly CatalogPlant[];
const names = {
  clover: "Clover",
  daisy: "Daisy",
  sunflower: "Sunflower",
  cherry: "Cherry",
};

// One statement gives every private field the same MVCC snapshot and DB instant.
// The optional instant is supplied only by an already locked mutation transaction.
export async function readDashboardSnapshot(
  db: QueryExecutor,
  scope: AuthenticatedScope,
  asOf?: Date,
): Promise<DashboardDTO> {
  const result = await db.execute(sql`
    with clock as materialized (select coalesce(${asOf ?? null}::timestamptz,clock_timestamp()) as as_of),
    owner as (select time_zone from users where id=${scope.userId}),
    day as (select clock.as_of,owner.time_zone,(clock.as_of at time zone owner.time_zone)::date as local_date from clock cross join owner)
    select day.as_of,day.time_zone,day.local_date::text,
      (select lifetime_completion_count from garden_state where user_id=${scope.userId}) as total,
      (select count(*)::int from habit_logs where user_id=${scope.userId}) as retained,
      coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'title',h.title,'completedToday',exists(select 1 from habit_logs l where l.user_id=${scope.userId} and l.habit_id=h.id and l.local_date=day.local_date),'runLength',s.run_length,'bestStreak',s.longest_streak,'lastCompletedOn',s.last_completed_on::text) order by h.created_at,h.id)
        from habits h left join habit_streaks s on s.habit_id=h.id and s.user_id=${scope.userId}
        where h.user_id=${scope.userId} and h.archived_at is null),'[]'::jsonb) as habits,
      coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'slotIndex',c.slot_index,'unlockAt',c.unlock_at,'owned',exists(select 1 from user_plants p where p.user_id=${scope.userId} and p.plant_id=c.id)) order by c.slot_index) from plant_catalog c),'[]'::jsonb) as plants
    from day`);
  const row = snapshotSchema.parse(result.rows[0]);
  if (row.time_zone === null) throw new ApplicationError("ONBOARDING_REQUIRED");
  if (
    row.local_date === null ||
    row.total === null ||
    row.total !== row.retained ||
    row.plants.length !== 4 ||
    row.habits.length > 10
  )
    throw new ApplicationError("SERVICE_UNAVAILABLE");
  const total = row.total;
  const localDate = civilDate(row.local_date);
  const plants = row.plants.map((plant, index) => {
    const expected = catalog[index];
    if (
      !expected ||
      plant.id !== expected.id ||
      plant.slotIndex !== expected.slotIndex ||
      plant.unlockAt !== expected.unlockAt ||
      plant.owned !== total >= plant.unlockAt
    )
      throw new ApplicationError("SERVICE_UNAVAILABLE");
    const identity = {
      plantId: plant.id,
      name: names[plant.id],
      slotIndex: plant.slotIndex,
      unlockAt: plant.unlockAt,
    };
    return plant.owned
      ? { ...identity, unlocked: true as const, ...projectPlant(total, plant) }
      : { ...identity, unlocked: false as const };
  });
  return {
    asOf: row.as_of.toISOString(),
    localDate,
    timeZone: row.time_zone,
    lifetimeCompletionCount: total,
    plants,
    habits: row.habits.map((habit) => ({
      id: habit.id,
      title: habit.title,
      completedToday: habit.completedToday,
      currentStreak: projectCurrentStreak(
        {
          runLength: habit.runLength,
          bestStreak: habit.bestStreak,
          lastCompletedOn:
            habit.lastCompletedOn === null
              ? null
              : civilDate(habit.lastCompletedOn),
        },
        localDate,
      ),
      bestStreak: habit.bestStreak,
    })),
  };
}

export async function dashboardForSession(
  db: Database,
  session: unknown,
): Promise<ActionResult<DashboardDTO>> {
  try {
    return {
      ok: true,
      data: await readDashboardSnapshot(db, sessionScope(session)),
    };
  } catch (error) {
    return safeFailure(error);
  }
}
