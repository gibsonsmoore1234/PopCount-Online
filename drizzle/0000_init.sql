CREATE TYPE "public"."bubble_kind" AS ENUM('CAMPUS', 'TOWN');--> statement-breakpoint
CREATE TYPE "public"."comment_kind" AS ENUM('COMMENT', 'ADVICE');--> statement-breakpoint
CREATE TYPE "public"."credit_reason" AS ENUM('SIGNUP_GRANT', 'PURCHASE', 'BOOST', 'ADMIN_ADJUST', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('MALE', 'FEMALE', 'NON_BINARY');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('OPEN', 'ACTIONED', 'DISMISSED');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('PROFILE', 'COMMENT', 'MESSAGE', 'BUBBLE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('USER', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."vote_event_kind" AS ENUM('RATE', 'BOOST');--> statement-breakpoint
CREATE TABLE "bubble_members" (
	"bubble_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bubble_members_bubble_id_user_id_pk" PRIMARY KEY("bubble_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "bubbles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" "bubble_kind" DEFAULT 'CAMPUS' NOT NULL,
	"badge" text,
	"logo_url" text,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"county_fips" text NOT NULL,
	"county_name" text NOT NULL,
	"state_name" text NOT NULL,
	"population" integer,
	"member_count" integer DEFAULT 0 NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"kind" "comment_kind" DEFAULT 'COMMENT' NOT NULL,
	"body" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" "credit_reason" NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"report_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bubble_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"created_by_id" uuid,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"byte_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"bubble_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"gender" "gender" NOT NULL,
	"affiliation" text,
	"bio" text DEFAULT '' NOT NULL,
	"photo_url" text NOT NULL,
	"rating_sum" integer DEFAULT 0 NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"up_count" integer DEFAULT 0 NOT NULL,
	"down_count" integer DEFAULT 0 NOT NULL,
	"rater_count" integer DEFAULT 0 NOT NULL,
	"aura_score" real,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"advice_count" integer DEFAULT 0 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"profile_id" uuid NOT NULL,
	"rater_id" uuid NOT NULL,
	"value" smallint NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ratings_profile_id_rater_id_pk" PRIMARY KEY("profile_id","rater_id"),
	CONSTRAINT "ratings_value_range" CHECK ("ratings"."value" between 0 and 100),
	CONSTRAINT "ratings_weight_pos" CHECK ("ratings"."weight" >= 1)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" "report_status" DEFAULT 'OPEN' NOT NULL,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"handle" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'USER' NOT NULL,
	"credit_balance" integer DEFAULT 0 NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"banned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_credit_balance_nonneg" CHECK ("users"."credit_balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vote_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"bubble_id" uuid NOT NULL,
	"rater_id" uuid NOT NULL,
	"kind" "vote_event_kind" NOT NULL,
	"value" smallint NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bubble_members" ADD CONSTRAINT "bubble_members_bubble_id_bubbles_id_fk" FOREIGN KEY ("bubble_id") REFERENCES "public"."bubbles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bubble_members" ADD CONSTRAINT "bubble_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bubbles" ADD CONSTRAINT "bubbles_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_messages" ADD CONSTRAINT "group_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_bubble_id_bubbles_id_fk" FOREIGN KEY ("bubble_id") REFERENCES "public"."bubbles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_bubble_id_bubbles_id_fk" FOREIGN KEY ("bubble_id") REFERENCES "public"."bubbles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_bubble_id_bubbles_id_fk" FOREIGN KEY ("bubble_id") REFERENCES "public"."bubbles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_events" ADD CONSTRAINT "vote_events_rater_id_users_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bubble_members_user_idx" ON "bubble_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bubbles_slug_key" ON "bubbles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "bubbles_county_idx" ON "bubbles" USING btree ("county_fips");--> statement-breakpoint
CREATE INDEX "bubbles_name_idx" ON "bubbles" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "comments_profile_kind_time_idx" ON "comments" USING btree ("profile_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "credit_tx_user_time_idx" ON "credit_transactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_tx_purchase_ref_key" ON "credit_transactions" USING btree ("reference") WHERE "credit_transactions"."reason" = 'PURCHASE';--> statement-breakpoint
CREATE INDEX "group_messages_group_time_idx" ON "group_messages" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_bubble_slug_key" ON "groups" USING btree ("bubble_id","slug");--> statement-breakpoint
CREATE INDEX "images_owner_idx" ON "images" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_key" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "profiles_bubble_aura_idx" ON "profiles" USING btree ("bubble_id","aura_score");--> statement-breakpoint
CREATE INDEX "profiles_bubble_votes_idx" ON "profiles" USING btree ("bubble_id","vote_count");--> statement-breakpoint
CREATE INDEX "profiles_aura_idx" ON "profiles" USING btree ("aura_score");--> statement-breakpoint
CREATE INDEX "profiles_gender_votes_idx" ON "profiles" USING btree ("gender","vote_count");--> statement-breakpoint
CREATE INDEX "profiles_name_idx" ON "profiles" USING btree (lower("display_name"));--> statement-breakpoint
CREATE INDEX "ratings_rater_idx" ON "ratings" USING btree ("rater_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_unique_per_reporter" ON "reports" USING btree ("reporter_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_time_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_handle_key" ON "users" USING btree (lower("handle"));--> statement-breakpoint
CREATE INDEX "vote_events_bubble_time_idx" ON "vote_events" USING btree ("bubble_id","created_at");--> statement-breakpoint
CREATE INDEX "vote_events_boost_cap_idx" ON "vote_events" USING btree ("rater_id","profile_id","created_at");