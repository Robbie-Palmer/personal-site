CREATE TYPE "public"."shopping_list_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TABLE "shopping_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"organization_id" text,
	"status" "shopping_list_status" DEFAULT 'active' NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"snapshot" jsonb NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shopping_list_owner_check" CHECK (num_nonnulls("shopping_list"."user_id", "shopping_list"."organization_id") = 1),
	CONSTRAINT "shopping_list_closed_at_check" CHECK (("shopping_list"."status" = 'active' AND "shopping_list"."closed_at" IS NULL) OR ("shopping_list"."status" = 'archived' AND "shopping_list"."closed_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list" ADD CONSTRAINT "shopping_list_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_list_active_user_uidx" ON "shopping_list" USING btree ("user_id") WHERE "shopping_list"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "shopping_list_active_household_uidx" ON "shopping_list" USING btree ("organization_id") WHERE "shopping_list"."status" = 'active';--> statement-breakpoint
CREATE INDEX "shopping_list_user_history_idx" ON "shopping_list" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "shopping_list_household_history_idx" ON "shopping_list" USING btree ("organization_id","created_at" DESC NULLS LAST);