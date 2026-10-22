CREATE TABLE "garden_state" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"lifetime_completion_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "garden_state_nonnegative" CHECK ("garden_state"."lifetime_completion_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"habit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"local_date" date NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "habit_logs_habit_id_local_date_pk" PRIMARY KEY("habit_id","local_date")
);
--> statement-breakpoint
CREATE TABLE "habit_streaks" (
	"habit_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"run_length" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_completed_on" date,
	CONSTRAINT "habit_streaks_valid" CHECK ("habit_streaks"."run_length" >= 0 and "habit_streaks"."longest_streak" >= "habit_streaks"."run_length" and (("habit_streaks"."last_completed_on" is null and "habit_streaks"."run_length" = 0 and "habit_streaks"."longest_streak" = 0) or ("habit_streaks"."last_completed_on" is not null and "habit_streaks"."run_length" >= 1)))
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "habits_owner_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "habits_title" CHECK (char_length("habits"."title") between 1 and 80 and "habits"."title" !~ '^[[:space:]]|[[:space:]]$'),
	CONSTRAINT "habits_archive_date" CHECK ("habits"."archived_at" is null or "habits"."archived_at" >= "habits"."created_at")
);
--> statement-breakpoint
CREATE TABLE "oauth_accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "oauth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id"),
	CONSTRAINT "oauth_accounts_provider" CHECK ("oauth_accounts"."provider" = 'github' and "oauth_accounts"."type" = 'oauth')
);
--> statement-breakpoint
CREATE TABLE "plant_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"slot_index" smallint NOT NULL,
	"unlock_at" integer NOT NULL,
	CONSTRAINT "plant_catalog_slot_index_unique" UNIQUE("slot_index"),
	CONSTRAINT "plant_catalog_unlock_at_unique" UNIQUE("unlock_at"),
	CONSTRAINT "plant_catalog_fixed" CHECK (("plant_catalog"."id" = 'clover' and "plant_catalog"."slot_index" = 0 and "plant_catalog"."unlock_at" = 0) or ("plant_catalog"."id" = 'daisy' and "plant_catalog"."slot_index" = 1 and "plant_catalog"."unlock_at" = 5) or ("plant_catalog"."id" = 'sunflower' and "plant_catalog"."slot_index" = 2 and "plant_catalog"."unlock_at" = 15) or ("plant_catalog"."id" = 'cherry' and "plant_catalog"."slot_index" = 3 and "plant_catalog"."unlock_at" = 30))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_plants" (
	"user_id" uuid NOT NULL,
	"plant_id" text NOT NULL,
	"unlocked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_plants_user_id_plant_id_pk" PRIMARY KEY("user_id","plant_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified_at" timestamp with time zone,
	"image" text,
	"time_zone" text,
	"initialized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_initialization_pair" CHECK (("users"."time_zone" is null) = ("users"."initialized_at" is null))
);
--> statement-breakpoint
ALTER TABLE "garden_state" ADD CONSTRAINT "garden_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_user_id_habit_id_habits_user_id_id_fk" FOREIGN KEY ("user_id","habit_id") REFERENCES "public"."habits"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_streaks" ADD CONSTRAINT "habit_streaks_user_id_habit_id_habits_user_id_id_fk" FOREIGN KEY ("user_id","habit_id") REFERENCES "public"."habits"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_plants" ADD CONSTRAINT "user_plants_plant_id_plant_catalog_id_fk" FOREIGN KEY ("plant_id") REFERENCES "public"."plant_catalog"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "habit_logs_owner_date_idx" ON "habit_logs" USING btree ("user_id","local_date" DESC NULLS LAST,"habit_id");--> statement-breakpoint
CREATE INDEX "habits_active_owner_idx" ON "habits" USING btree ("user_id","created_at","id") WHERE "habits"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
--> statement-breakpoint
-- Reviewed SQL additions: Drizzle snapshots do not represent triggers or grants.
CREATE FUNCTION public.guard_initialized_timezone() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.initialized_at IS NOT NULL AND
    (NEW.time_zone IS DISTINCT FROM OLD.time_zone OR NEW.initialized_at IS DISTINCT FROM OLD.initialized_at) THEN
    RAISE EXCEPTION 'Initialized timezone is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_fixed_timezone BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_initialized_timezone();
--> statement-breakpoint
CREATE FUNCTION public.guard_archived_habit() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'Archive is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER habits_fixed_archive BEFORE UPDATE ON public.habits
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_habit();
--> statement-breakpoint
CREATE FUNCTION public.reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'History is immutable' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER habit_logs_immutable BEFORE UPDATE OR DELETE ON public.habit_logs
FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
--> statement-breakpoint
CREATE TRIGGER user_plants_immutable BEFORE UPDATE OR DELETE ON public.user_plants
FOR EACH ROW EXECUTE FUNCTION public.reject_history_mutation();
--> statement-breakpoint
INSERT INTO public.plant_catalog(id, slot_index, unlock_at) VALUES
  ('clover',0,0), ('daisy',1,5), ('sunflower',2,15), ('cherry',3,30);
--> statement-breakpoint
-- Role is provisioned independently with a private login credential. Never grant
-- migration ownership/membership to the runtime login, locally or in hosting.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO habit_garden_runtime;
GRANT SELECT, INSERT, UPDATE ON public.users, public.habits, public.habit_streaks, public.garden_state TO habit_garden_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oauth_accounts, public.sessions TO habit_garden_runtime;
GRANT SELECT, INSERT ON public.habit_logs, public.user_plants TO habit_garden_runtime;
GRANT SELECT ON public.plant_catalog TO habit_garden_runtime;
