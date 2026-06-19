-- Admin plugin: add role and ban fields to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_reason" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp with time zone;

-- Admin plugin: add impersonation tracking to session table
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "impersonated_by" text;
