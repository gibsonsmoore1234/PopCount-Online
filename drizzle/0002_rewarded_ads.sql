CREATE TABLE "ad_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"advertiser" text DEFAULT '' NOT NULL,
	"media_url" text NOT NULL,
	"media_type" text DEFAULT 'image' NOT NULL,
	"click_url" text,
	"duration_seconds" integer DEFAULT 10 NOT NULL,
	"reward_clicks" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"completions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_views" ADD CONSTRAINT "ad_views_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_views" ADD CONSTRAINT "ad_views_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ad_views_user_idx" ON "ad_views" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "ads_active_idx" ON "ads" USING btree ("is_active");