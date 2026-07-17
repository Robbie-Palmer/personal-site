-- This first migration also adopts databases previously managed by
-- `drizzle-kit push`. Only the baseline is intentionally idempotent; later
-- migrations must fail loudly if their expected starting state is absent.
DO $$ BEGIN
	CREATE TYPE "public"."diet_recipe_match_mode" AS ENUM('hide', 'warn');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."recipe_import_stage" AS ENUM('extract', 'normalize', 'canonicalize', 'finalize');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."recipe_import_status" AS ENUM('queued', 'running', 'succeeded', 'failed');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."visibility" AS ENUM('public', 'private', 'household');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diet_preset" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diet_preset_excluded_group" (
	"preset_key" text NOT NULL,
	"group_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diet_preset_excluded_group_pk" PRIMARY KEY("preset_key","group_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "diet_preset_excluded_ingredient" (
	"preset_key" text NOT NULL,
	"ingredient_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diet_preset_excluded_ingredient_pk" PRIMARY KEY("preset_key","ingredient_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingredient" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingredient_group" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ingredient_group_member" (
	"group_key" text NOT NULL,
	"ingredient_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_group_member_pk" PRIMARY KEY("group_key","ingredient_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_event" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"actor_user_id" text,
	"actor_name_snapshot" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_household_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"household_id" text,
	"household_name_snapshot" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_household_invitation_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"invitation_id" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"body" text,
	"user_id" text NOT NULL,
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_import_artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"stage" "recipe_import_stage" NOT NULL,
	"kind" text NOT NULL,
	"r2_key" text NOT NULL,
	"checksum" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"model" text,
	"provider" text,
	"preview" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_import_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"stage" "recipe_import_stage" NOT NULL,
	"attempt" integer NOT NULL,
	"succeeded" boolean NOT NULL,
	"retryable" boolean,
	"provider_request_id" text,
	"error_type" text,
	"error_message" text,
	"duration_ms" integer,
	"model" text,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recipe_import_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" "recipe_import_status" DEFAULT 'queued' NOT NULL,
	"current_stage" "recipe_import_stage",
	"progress_label" text,
	"error_type" text,
	"error_message" text,
	"workflow_instance_id" text,
	"image_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"role" text DEFAULT 'user',
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_diet_excluded_group" (
	"user_id" text NOT NULL,
	"group_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_diet_excluded_group_pk" PRIMARY KEY("user_id","group_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_diet_excluded_ingredient" (
	"user_id" text NOT NULL,
	"ingredient_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_diet_excluded_ingredient_pk" PRIMARY KEY("user_id","ingredient_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_diet_preset" (
	"user_id" text NOT NULL,
	"preset_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_diet_preset_pk" PRIMARY KEY("user_id","preset_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_diet_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"recipe_match_mode" "diet_recipe_match_mode" DEFAULT 'hide' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_email" (
	"email" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_recipe_box" (
	"user_id" text PRIMARY KEY NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_recipe_box_item" (
	"user_id" text NOT NULL,
	"recipe_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_recipe_box_item_user_id_recipe_slug_pk" PRIMARY KEY("user_id","recipe_slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "diet_preset_excluded_group" ADD CONSTRAINT "diet_preset_excluded_group_preset_key_diet_preset_key_fk" FOREIGN KEY ("preset_key") REFERENCES "public"."diet_preset"("key") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "diet_preset_excluded_group" ADD CONSTRAINT "diet_preset_excluded_group_group_key_ingredient_group_key_fk" FOREIGN KEY ("group_key") REFERENCES "public"."ingredient_group"("key") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "diet_preset_excluded_ingredient" ADD CONSTRAINT "diet_preset_excluded_ingredient_preset_key_diet_preset_key_fk" FOREIGN KEY ("preset_key") REFERENCES "public"."diet_preset"("key") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "diet_preset_excluded_ingredient" ADD CONSTRAINT "diet_preset_excluded_ingredient_ingredient_slug_ingredient_slug_fk" FOREIGN KEY ("ingredient_slug") REFERENCES "public"."ingredient"("slug") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "ingredient_group_member" ADD CONSTRAINT "ingredient_group_member_group_key_ingredient_group_key_fk" FOREIGN KEY ("group_key") REFERENCES "public"."ingredient_group"("key") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "ingredient_group_member" ADD CONSTRAINT "ingredient_group_member_ingredient_slug_ingredient_slug_fk" FOREIGN KEY ("ingredient_slug") REFERENCES "public"."ingredient"("slug") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_event_id_notification_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "notification_event" ADD CONSTRAINT "notification_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "notification_household_event" ADD CONSTRAINT "notification_household_event_event_id_notification_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "notification_household_event" ADD CONSTRAINT "notification_household_event_household_id_organization_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "notification_household_invitation_event" ADD CONSTRAINT "notification_household_invitation_event_event_id_notification_household_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_household_event"("event_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "notification_household_invitation_event" ADD CONSTRAINT "notification_household_invitation_event_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitation"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "recipe" ADD CONSTRAINT "recipe_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "recipe_import_artifact" ADD CONSTRAINT "recipe_import_artifact_job_id_recipe_import_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."recipe_import_job"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "recipe_import_attempt" ADD CONSTRAINT "recipe_import_attempt_job_id_recipe_import_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."recipe_import_job"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "recipe_import_job" ADD CONSTRAINT "recipe_import_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_diet_excluded_group" ADD CONSTRAINT "user_diet_excluded_group_user_id_user_diet_profile_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_diet_profile"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_diet_excluded_group" ADD CONSTRAINT "user_diet_excluded_group_group_key_ingredient_group_key_fk" FOREIGN KEY ("group_key") REFERENCES "public"."ingredient_group"("key") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_diet_excluded_ingredient" ADD CONSTRAINT "user_diet_excluded_ingredient_user_id_user_diet_profile_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_diet_profile"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_diet_excluded_ingredient" ADD CONSTRAINT "user_diet_excluded_ingredient_ingredient_slug_ingredient_slug_fk" FOREIGN KEY ("ingredient_slug") REFERENCES "public"."ingredient"("slug") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_diet_preset" ADD CONSTRAINT "user_diet_preset_user_id_user_diet_profile_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_diet_profile"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_diet_preset" ADD CONSTRAINT "user_diet_preset_preset_key_diet_preset_key_fk" FOREIGN KEY ("preset_key") REFERENCES "public"."diet_preset"("key") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_diet_profile" ADD CONSTRAINT "user_diet_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_email" ADD CONSTRAINT "user_email_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_recipe_box" ADD CONSTRAINT "user_recipe_box_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "user_recipe_box_item" ADD CONSTRAINT "user_recipe_box_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
-- Replace the former deploy-time backfill with a versioned, transactional data
-- migration. This is a no-op for a fresh database.
INSERT INTO "user_email" ("email", "user_id", "verified", "is_primary")
SELECT "email", "id", "email_verified", true
FROM "user"
ON CONFLICT ("email") DO UPDATE SET
	"user_id" = excluded."user_id",
	"verified" = excluded."verified",
	"is_primary" = true,
	"updated_at" = now();--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "diet_preset_excluded_group_group_key_idx" ON "diet_preset_excluded_group" USING btree ("group_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "diet_preset_excluded_ingredient_slug_idx" ON "diet_preset_excluded_ingredient" USING btree ("ingredient_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ingredient_group_member_ingredient_slug_idx" ON "ingredient_group_member" USING btree ("ingredient_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitation_status_idx" ON "invitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_organization_id_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "member_user_unique" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_delivery_event_recipient_uidx" ON "notification_delivery" USING btree ("event_id","recipient_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_delivery_recipient_read_at_idx" ON "notification_delivery" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_event_kind_idx" ON "notification_event" USING btree ("kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_household_event_household_idx" ON "notification_household_event" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_household_invitation_event_invitation_idx" ON "notification_household_invitation_event" USING btree ("invitation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_user_id_idx" ON "recipe" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_public_feed_idx" ON "recipe" USING btree ("visibility","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_household_feed_idx" ON "recipe" USING btree ("user_id","visibility","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_import_artifact_job_id_idx" ON "recipe_import_artifact" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recipe_import_artifact_job_stage_kind_unique" ON "recipe_import_artifact" USING btree ("job_id","stage","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_import_attempt_job_id_idx" ON "recipe_import_attempt" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "recipe_import_attempt_job_stage_attempt_unique" ON "recipe_import_attempt" USING btree ("job_id","stage","attempt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_import_job_user_id_idx" ON "recipe_import_job" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_import_job_user_status_idx" ON "recipe_import_job" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recipe_import_job_user_created_idx" ON "recipe_import_job" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_diet_excluded_group_group_key_idx" ON "user_diet_excluded_group" USING btree ("group_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_diet_excluded_ingredient_slug_idx" ON "user_diet_excluded_ingredient" USING btree ("ingredient_slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_diet_preset_preset_key_idx" ON "user_diet_preset" USING btree ("preset_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_user_id_idx" ON "user_email" USING btree ("user_id");
