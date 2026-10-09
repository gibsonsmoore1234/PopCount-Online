DROP INDEX "profiles_user_key";--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_bubble_key" ON "profiles" USING btree ("user_id","bubble_id");