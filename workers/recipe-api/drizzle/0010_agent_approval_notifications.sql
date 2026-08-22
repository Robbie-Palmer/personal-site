CREATE TABLE "notification_agent_approval_event" (
	"event_id" text PRIMARY KEY NOT NULL,
	"approval_request_id" text,
	"agent_id_snapshot" text NOT NULL,
	"agent_name_snapshot" text NOT NULL,
	"capabilities_snapshot" text NOT NULL,
	"expires_at_snapshot" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_agent_approval_event" ADD CONSTRAINT "notification_agent_approval_event_event_id_notification_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_agent_approval_event" ADD CONSTRAINT "notification_agent_approval_event_approval_request_id_approval_request_id_fk" FOREIGN KEY ("approval_request_id") REFERENCES "public"."approval_request"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_agent_approval_request_uidx" ON "notification_agent_approval_event" USING btree ("approval_request_id");