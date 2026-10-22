import type pg from "pg";

const at = "2026-01-01T12:00:00Z";
const mira = "30000000-0000-4000-8000-000000000001";
const rowan = "30000000-0000-4000-8000-000000000002";
const reading = "40000000-0000-4000-8000-000000000001";
const walking = "40000000-0000-4000-8000-000000000002";

const fixtures = [
  {
    table: "users",
    keys: ["id"],
    rows: [
      {
        id: mira,
        name: "Mira Example",
        email: "mira@example.invalid",
        email_verified_at: null,
        image: null,
        time_zone: "Asia/Kuala_Lumpur",
        initialized_at: at,
        created_at: at,
      },
      {
        id: rowan,
        name: "Rowan Example",
        email: "rowan@example.invalid",
        email_verified_at: null,
        image: null,
        time_zone: "America/New_York",
        initialized_at: at,
        created_at: at,
      },
    ],
  },
  {
    table: "habits",
    keys: ["id"],
    rows: [
      {
        id: reading,
        user_id: mira,
        title: "Read a page",
        created_at: at,
        updated_at: at,
        archived_at: null,
      },
      {
        id: walking,
        user_id: rowan,
        title: "Take a walk",
        created_at: at,
        updated_at: at,
        archived_at: null,
      },
    ],
  },
  {
    table: "habit_logs",
    keys: ["habit_id", "local_date"],
    rows: [1, 2, 3, 4, 5].map((day) => ({
      habit_id: reading,
      user_id: mira,
      local_date: `2026-01-0${day}`,
      completed_at: `2026-01-0${day}T12:00:00Z`,
    })),
  },
  {
    table: "habit_streaks",
    keys: ["habit_id"],
    rows: [
      {
        habit_id: reading,
        user_id: mira,
        run_length: 5,
        longest_streak: 5,
        last_completed_on: "2026-01-05",
      },
      {
        habit_id: walking,
        user_id: rowan,
        run_length: 0,
        longest_streak: 0,
        last_completed_on: null,
      },
    ],
  },
  {
    table: "garden_state",
    keys: ["user_id"],
    rows: [
      {
        user_id: mira,
        lifetime_completion_count: 5,
        updated_at: "2026-01-05T12:00:00Z",
      },
      { user_id: rowan, lifetime_completion_count: 0, updated_at: at },
    ],
  },
  {
    table: "user_plants",
    keys: ["user_id", "plant_id"],
    rows: [
      { user_id: mira, plant_id: "clover", unlocked_at: at },
      { user_id: mira, plant_id: "daisy", unlocked_at: "2026-01-05T12:00:00Z" },
      { user_id: rowan, plant_id: "clover", unlocked_at: at },
    ],
  },
] as const;

// Internal fixture engine; CLI/test harness validate the target before connecting.
// This owns its transaction. It never updates, deletes or manufactures sessions.
export async function seedFixtures(client: pg.Client): Promise<void> {
  await client.query("begin");
  try {
    await client.query(
      "select set_config('lock_timeout',$1,true),set_config('statement_timeout',$2,true)",
      ["10000", "15000"],
    );
    await client.query(
      "select pg_advisory_xact_lock($1::int,$2::int)",
      [7147068, 2],
    );
    await client.query(
      "select id from users where id=any($1::uuid[]) order by id for update",
      [[mira, rowan]],
    );
    const catalog = await client.query(
      "select id,slot_index,unlock_at from plant_catalog order by slot_index",
    );
    if (
      JSON.stringify(catalog.rows) !==
      JSON.stringify([
        { id: "clover", slot_index: 0, unlock_at: 0 },
        { id: "daisy", slot_index: 1, unlock_at: 5 },
        { id: "sunflower", slot_index: 2, unlock_at: 15 },
        { id: "cherry", slot_index: 3, unlock_at: 30 },
      ])
    )
      throw new Error("Fixture conflict in catalog.");
    for (const group of fixtures) {
      // Identifiers come exclusively from the fixed internal catalog above.
      const table = `public."${group.table}"`;
      const keyPredicate = group.keys
        .map((key) => `actual."${key}" = expected."${key}"`)
        .join(" and ");
      for (const row of group.rows) {
        const payload = JSON.stringify(row);
        await client.query(
          `insert into ${table} select * from jsonb_populate_record(null::${table},$1::jsonb) on conflict do nothing`,
          [payload],
        );
        const comparison = await client.query<{ matches: boolean }>(
          `select to_jsonb(actual) = to_jsonb(expected) as matches from ${table} actual cross join jsonb_populate_record(null::${table},$1::jsonb) expected where ${keyPredicate}`,
          [payload],
        );
        if (
          comparison.rows.length !== 1 ||
          comparison.rows[0]?.matches !== true
        )
          throw new Error(`Fixture conflict in ${group.table}.`);
      }
    }
    // A conflicting extra history/reward row is also a conflict, not seed repair.
    const consistency = await client.query<{ valid: boolean }>(
      "select not exists(select 1 from garden_state g where g.user_id=any($1::uuid[]) and g.lifetime_completion_count <> (select count(*) from habit_logs l where l.user_id=g.user_id)) and (select count(*) from user_plants where user_id=any($1::uuid[]))=3 as valid",
      [[mira, rowan]],
    );
    if (!consistency.rows[0]?.valid)
      throw new Error("Fixture conflict in retained history.");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
