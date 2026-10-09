ALTER TYPE "public"."credit_reason" ADD VALUE 'AD_REWARD';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_anonymous" boolean DEFAULT false NOT NULL;