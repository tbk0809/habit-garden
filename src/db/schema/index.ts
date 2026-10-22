import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  smallint,
  varchar,
  date,
  primaryKey,
  unique,
  index,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";

const instant = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().$defaultFn(randomUUID),
    name: text("name"),
    email: text("email").unique(),
    emailVerified: instant("email_verified_at"),
    image: text("image"),
    timeZone: text("time_zone"),
    initializedAt: instant("initialized_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "users_initialization_pair",
      sql`(${t.timeZone} is null) = (${t.initializedAt} is null)`,
    ),
  ],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<"oauth">().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("oauth_accounts_user_idx").on(t.userId),
    check(
      "oauth_accounts_provider",
      sql`${t.provider} = 'github' and ${t.type} = 'oauth'`,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: instant("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const habits = pgTable(
  "habits",
  {
    id: uuid("id").primaryKey().$defaultFn(randomUUID),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 80 }).notNull(),
    createdAt: instant("created_at").notNull(),
    updatedAt: instant("updated_at").notNull(),
    archivedAt: instant("archived_at"),
  },
  (t) => [
    unique("habits_owner_id_unique").on(t.userId, t.id),
    index("habits_active_owner_idx")
      .on(t.userId, t.createdAt, t.id)
      .where(sql`${t.archivedAt} is null`),
    check(
      "habits_title",
      sql`char_length(${t.title}) between 1 and 80 and ${t.title} !~ '^[[:space:]]|[[:space:]]$'`,
    ),
    check(
      "habits_archive_date",
      sql`${t.archivedAt} is null or ${t.archivedAt} >= ${t.createdAt}`,
    ),
  ],
);

export const habitLogs = pgTable(
  "habit_logs",
  {
    habitId: uuid("habit_id").notNull(),
    userId: uuid("user_id").notNull(),
    localDate: date("local_date", { mode: "string" }).notNull(),
    completedAt: instant("completed_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.habitId, t.localDate] }),
    foreignKey({
      columns: [t.userId, t.habitId],
      foreignColumns: [habits.userId, habits.id],
    }).onDelete("restrict"),
    index("habit_logs_owner_date_idx").on(
      t.userId,
      t.localDate.desc(),
      t.habitId,
    ),
  ],
);

export const habitStreaks = pgTable(
  "habit_streaks",
  {
    habitId: uuid("habit_id").primaryKey(),
    userId: uuid("user_id").notNull(),
    runLength: integer("run_length").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastCompletedOn: date("last_completed_on", { mode: "string" }),
  },
  (t) => [
    foreignKey({
      columns: [t.userId, t.habitId],
      foreignColumns: [habits.userId, habits.id],
    }).onDelete("restrict"),
    check(
      "habit_streaks_valid",
      sql`${t.runLength} >= 0 and ${t.longestStreak} >= ${t.runLength} and ((${t.lastCompletedOn} is null and ${t.runLength} = 0 and ${t.longestStreak} = 0) or (${t.lastCompletedOn} is not null and ${t.runLength} >= 1))`,
    ),
  ],
);

export const plantCatalog = pgTable(
  "plant_catalog",
  {
    id: text("id").primaryKey(),
    slotIndex: smallint("slot_index").notNull().unique(),
    unlockAt: integer("unlock_at").notNull().unique(),
  },
  (t) => [
    check(
      "plant_catalog_fixed",
      sql`(${t.id} = 'clover' and ${t.slotIndex} = 0 and ${t.unlockAt} = 0) or (${t.id} = 'daisy' and ${t.slotIndex} = 1 and ${t.unlockAt} = 5) or (${t.id} = 'sunflower' and ${t.slotIndex} = 2 and ${t.unlockAt} = 15) or (${t.id} = 'cherry' and ${t.slotIndex} = 3 and ${t.unlockAt} = 30)`,
    ),
  ],
);

export const userPlants = pgTable(
  "user_plants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    plantId: text("plant_id")
      .notNull()
      .references(() => plantCatalog.id, { onDelete: "restrict" }),
    unlockedAt: instant("unlocked_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.plantId] })],
);

export const gardenState = pgTable(
  "garden_state",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "restrict" }),
    lifetimeCompletionCount: integer("lifetime_completion_count")
      .notNull()
      .default(0),
    updatedAt: instant("updated_at").notNull(),
  },
  (t) => [
    check("garden_state_nonnegative", sql`${t.lifetimeCompletionCount} >= 0`),
  ],
);

// GitHub OAuth uses these three custom tables; email/WebAuthn tables are unused.
export const adapterTables = {
  usersTable: users,
  accountsTable: oauthAccounts,
  sessionsTable: sessions,
};
