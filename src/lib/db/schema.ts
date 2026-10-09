import { relations, sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ────────────────────────────────────────────────────────────────────────── */
/* Enums                                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

export const userRole = pgEnum("user_role", ["USER", "ADMIN"]);
export const gender = pgEnum("gender", ["MALE", "FEMALE", "NON_BINARY"]);
export const bubbleKind = pgEnum("bubble_kind", ["CAMPUS", "TOWN"]);
export const commentKind = pgEnum("comment_kind", ["COMMENT", "ADVICE"]);
export const voteEventKind = pgEnum("vote_event_kind", ["RATE", "BOOST"]);
export const reportTarget = pgEnum("report_target", ["PROFILE", "COMMENT", "MESSAGE", "BUBBLE"]);
export const reportStatus = pgEnum("report_status", ["OPEN", "ACTIONED", "DISMISSED"]);
export const creditReason = pgEnum("credit_reason", [
  "SIGNUP_GRANT",
  "PURCHASE",
  "BOOST",
  "ADMIN_ADJUST",
  "REFUND",
  "AD_REWARD",
  "ACTION",
]);

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => (Buffer.isBuffer(value) ? value : Buffer.from(value)),
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

/* ────────────────────────────────────────────────────────────────────────── */
/* Identity                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    handle: text("handle").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("USER"),
    /** Auto-provisioned device identity — browses, rates and comments without ever signing up. */
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    /** Boost credit balance in cents. One cent = one boost click. */
    creditBalance: integer("credit_balance").notNull().default(0),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true, mode: "date" }),
    bannedAt: timestamp("banned_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_key").on(sql`lower(${t.email})`),
    uniqueIndex("users_handle_key").on(sql`lower(${t.handle})`),
    check("users_credit_balance_nonneg", sql`${t.creditBalance} >= 0`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 hex digest of the session token — the raw token only lives in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Bubbles (campuses & towns on the map)                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export const bubbles = pgTable(
  "bubbles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    kind: bubbleKind("kind").notNull().default("CAMPUS"),
    badge: text("badge"),
    logoUrl: text("logo_url"),
    lat: doublePrecision("lat").notNull(),
    lng: doublePrecision("lng").notNull(),
    countyFips: text("county_fips").notNull(),
    countyName: text("county_name").notNull(),
    stateName: text("state_name").notNull(),
    /** Optional real-world population (e.g. enrolled students) shown in the campus stats panel. */
    population: integer("population"),
    memberCount: integer("member_count").notNull().default(0),
    isOfficial: boolean("is_official").notNull().default(false),
    isHidden: boolean("is_hidden").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bubbles_slug_key").on(t.slug),
    index("bubbles_county_idx").on(t.countyFips),
    index("bubbles_name_idx").on(sql`lower(${t.name})`),
  ],
);

export const bubbleMembers = pgTable(
  "bubble_members",
  {
    bubbleId: uuid("bubble_id")
      .notNull()
      .references(() => bubbles.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.bubbleId, t.userId] }), index("bubble_members_user_idx").on(t.userId)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Profiles & Aura                                                            */
/* ────────────────────────────────────────────────────────────────────────── */

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Profiles are opt-in: each account owns at most one profile — its own. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bubbleId: uuid("bubble_id")
      .notNull()
      .references(() => bubbles.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    gender: gender("gender").notNull(),
    affiliation: text("affiliation"),
    bio: text("bio").notNull().default(""),
    photoUrl: text("photo_url").notNull(),
    /** Σ(value × weight) over all ratings. */
    ratingSum: integer("rating_sum").notNull().default(0),
    /** Σ(weight) — every free rating counts once, every boost click adds one more. */
    voteCount: integer("vote_count").notNull().default(0),
    upCount: integer("up_count").notNull().default(0),
    downCount: integer("down_count").notNull().default(0),
    raterCount: integer("rater_count").notNull().default(0),
    /** Weighted mean of all ratings, rounded to tenths. NULL until the first vote. */
    auraScore: real("aura_score"),
    commentCount: integer("comment_count").notNull().default(0),
    adviceCount: integer("advice_count").notNull().default(0),
    isHidden: boolean("is_hidden").notNull().default(false),
    ...timestamps,
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("profiles_user_key").on(t.userId),
    index("profiles_bubble_aura_idx").on(t.bubbleId, t.auraScore),
    index("profiles_bubble_votes_idx").on(t.bubbleId, t.voteCount),
    index("profiles_aura_idx").on(t.auraScore),
    index("profiles_gender_votes_idx").on(t.gender, t.voteCount),
    index("profiles_name_idx").on(sql`lower(${t.displayName})`),
  ],
);

export const ratings = pgTable(
  "ratings",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    raterId: uuid("rater_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    value: smallint("value").notNull(),
    /** 1 for the free vote + 1 per paid boost click. */
    weight: integer("weight").notNull().default(1),
    ...timestamps,
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.profileId, t.raterId] }),
    index("ratings_rater_idx").on(t.raterId),
    check("ratings_value_range", sql`${t.value} between 0 and 100`),
    check("ratings_weight_pos", sql`${t.weight} >= 1`),
  ],
);

/** Append-only log of every rating action — powers activity rankings, boost caps and audits. */
export const voteEvents = pgTable(
  "vote_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    bubbleId: uuid("bubble_id")
      .notNull()
      .references(() => bubbles.id, { onDelete: "cascade" }),
    raterId: uuid("rater_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: voteEventKind("kind").notNull(),
    value: smallint("value").notNull(),
    weight: integer("weight").notNull().default(1),
    ...timestamps,
  },
  (t) => [
    index("vote_events_bubble_time_idx").on(t.bubbleId, t.createdAt),
    index("vote_events_boost_cap_idx").on(t.raterId, t.profileId, t.createdAt),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Discussion                                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: commentKind("kind").notNull().default("COMMENT"),
    body: text("body").notNull(),
    isHidden: boolean("is_hidden").notNull().default(false),
    reportCount: integer("report_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("comments_profile_kind_time_idx").on(t.profileId, t.kind, t.createdAt)],
);

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bubbleId: uuid("bubble_id")
      .notNull()
      .references(() => bubbles.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    messageCount: integer("message_count").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("groups_bubble_slug_key").on(t.bubbleId, t.slug)],
);

export const groupMessages = pgTable(
  "group_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    isHidden: boolean("is_hidden").notNull().default(false),
    reportCount: integer("report_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("group_messages_group_time_idx").on(t.groupId, t.createdAt)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Trust & safety                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: reportTarget("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    status: reportStatus("status").notNull().default("OPEN"),
    resolvedById: uuid("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("reports_unique_per_reporter").on(t.reporterId, t.targetType, t.targetId),
    index("reports_status_time_idx").on(t.status, t.createdAt),
    index("reports_target_idx").on(t.targetType, t.targetId),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Micro-economy                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Signed amount in cents. */
    amount: integer("amount").notNull(),
    reason: creditReason("reason").notNull(),
    /** External reference (Stripe Checkout session id, profile id…). Unique for purchases → idempotent webhooks. */
    reference: text("reference"),
    ...timestamps,
  },
  (t) => [
    index("credit_tx_user_time_idx").on(t.userId, t.createdAt),
    uniqueIndex("credit_tx_purchase_ref_key")
      .on(t.reference)
      .where(sql`${t.reason} = 'PURCHASE'`),
  ],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Media                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    bytes: bytea("bytes").notNull(),
    byteSize: integer("byte_size").notNull(),
    ...timestamps,
  },
  (t) => [index("images_owner_idx").on(t.ownerId)],
);

/* ────────────────────────────────────────────────────────────────────────── */
/* Relations                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  sessions: many(sessions),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
  bubble: one(bubbles, { fields: [profiles.bubbleId], references: [bubbles.id] }),
  ratings: many(ratings),
  comments: many(comments),
}));

export const bubblesRelations = relations(bubbles, ({ many }) => ({
  profiles: many(profiles),
  groups: many(groups),
}));

export type User = typeof users.$inferSelect;
export type Bubble = typeof bubbles.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type GroupMessage = typeof groupMessages.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type Gender = (typeof gender.enumValues)[number];
export type BubbleKind = (typeof bubbleKind.enumValues)[number];
export type CommentKind = (typeof commentKind.enumValues)[number];
export type ReportTarget = (typeof reportTarget.enumValues)[number];

/* ────────────────────────────────────────────────────────────────────────── */
/* Rewarded ads (watch 10 s → +10 boost clicks)                               */
/* ────────────────────────────────────────────────────────────────────────── */

export const ads = pgTable(
  "ads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    advertiser: text("advertiser").notNull().default(""),
    /** Served from /api/images/:id (uploaded media) or any https URL. */
    mediaUrl: text("media_url").notNull(),
    mediaType: text("media_type").notNull().default("image"), // "image" | "video"
    clickUrl: text("click_url"),
    durationSeconds: integer("duration_seconds").notNull().default(10),
    rewardClicks: integer("reward_clicks").notNull().default(10),
    isActive: boolean("is_active").notNull().default(true),
    impressions: integer("impressions").notNull().default(0),
    completions: integer("completions").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("ads_active_idx").on(t.isActive)],
);

export const adViews = pgTable(
  "ad_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adId: uuid("ad_id")
      .notNull()
      .references(() => ads.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
  },
  (t) => [index("ad_views_user_idx").on(t.userId, t.startedAt)],
);

export type Ad = typeof ads.$inferSelect;
