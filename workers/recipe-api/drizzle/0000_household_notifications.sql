CREATE TABLE "notification_event" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"actor_user_id" text,
	"actor_name_snapshot" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notification_household_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"household_id" text,
	"household_name_snapshot" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_household_invitation_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"invitation_id" text
);
--> statement-breakpoint
ALTER TABLE "notification_event" ADD CONSTRAINT "notification_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_event_id_notification_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_household_event" ADD CONSTRAINT "notification_household_event_event_id_notification_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_household_event" ADD CONSTRAINT "notification_household_event_household_id_organization_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_household_invitation_event" ADD CONSTRAINT "notification_household_invitation_event_event_id_notification_household_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_household_event"("event_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_household_invitation_event" ADD CONSTRAINT "notification_household_invitation_event_invitation_id_invitation_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."invitation"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "notification_event_kind_idx" ON "notification_event" USING btree ("kind");
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_delivery_event_recipient_uidx" ON "notification_delivery" USING btree ("event_id","recipient_user_id");
--> statement-breakpoint
CREATE INDEX "notification_delivery_recipient_read_at_idx" ON "notification_delivery" USING btree ("recipient_user_id","read_at");
--> statement-breakpoint
CREATE INDEX "notification_household_event_household_idx" ON "notification_household_event" USING btree ("household_id");
--> statement-breakpoint
CREATE INDEX "notification_household_invitation_event_invitation_idx" ON "notification_household_invitation_event" USING btree ("invitation_id");
