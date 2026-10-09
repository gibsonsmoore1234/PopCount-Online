import { and, eq, sql, type SQL } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { bubbles, profiles, users } from "@/lib/db/schema";
import { roundTenth } from "@/lib/aura";
import type { BubbleSummary, ProfileCard } from "@/types/api";

/* ── Profile cards ─────────────────────────────────────────────────────── */

export const profileCardColumns = {
  id: profiles.id,
  displayName: profiles.displayName,
  handle: users.handle,
  gender: profiles.gender,
  affiliation: profiles.affiliation,
  photoUrl: profiles.photoUrl,
  auraScore: profiles.auraScore,
  voteCount: profiles.voteCount,
  upCount: profiles.upCount,
  downCount: profiles.downCount,
  commentCount: sql<number>`(${profiles.commentCount} + ${profiles.adviceCount})::int`,
  bubbleSlug: bubbles.slug,
  bubbleName: bubbles.name,
};

export type ProfileCardRow = {
  id: string;
  displayName: string;
  handle: string;
  gender: ProfileCard["gender"];
  affiliation: string | null;
  photoUrl: string;
  auraScore: number | null;
  voteCount: number;
  upCount: number;
  downCount: number;
  commentCount: number;
  bubbleSlug: string;
  bubbleName: string;
};

export function cardQuery(tx: DbOrTx = db) {
  return tx
    .select(profileCardColumns)
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .innerJoin(bubbles, eq(bubbles.id, profiles.bubbleId));
}

/** Visible = not moderated away, owner not banned, bubble not hidden. */
export const visibleProfile: SQL = and(
  eq(profiles.isHidden, false),
  eq(bubbles.isHidden, false),
  sql`${users.bannedAt} is null`,
)!;

export function toCard(row: ProfileCardRow): ProfileCard {
  return {
    id: row.id,
    displayName: row.displayName,
    handle: row.handle,
    gender: row.gender,
    affiliation: row.affiliation,
    photoUrl: row.photoUrl,
    auraScore: row.auraScore === null ? null : roundTenth(Number(row.auraScore)),
    voteCount: Number(row.voteCount),
    upCount: Number(row.upCount),
    downCount: Number(row.downCount),
    commentCount: Number(row.commentCount),
    bubble: { slug: row.bubbleSlug, name: row.bubbleName },
  };
}

/* ── Bubble summaries ──────────────────────────────────────────────────── */

export function bubbleStatsSubquery(tx: DbOrTx = db) {
  return tx
    .select({
      bubbleId: profiles.bubbleId,
      profileCount: sql<number>`count(*)::int`.as("profile_count"),
      avgAura: sql<number | null>`(avg(${profiles.auraScore}) filter (where ${profiles.voteCount} > 0))::float8`.as(
        "avg_aura",
      ),
      totalVotes: sql<number>`coalesce(sum(${profiles.voteCount}), 0)::int`.as("total_votes"),
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(eq(profiles.isHidden, false), sql`${users.bannedAt} is null`))
    .groupBy(profiles.bubbleId)
    .as("ps");
}

export function bubbleSummaryQuery(tx: DbOrTx = db) {
  const ps = bubbleStatsSubquery(tx);
  return tx
    .select({
      bubble: bubbles,
      profileCount: sql<number>`coalesce(${ps.profileCount}, 0)::int`,
      avgAura: ps.avgAura,
      totalVotes: sql<number>`coalesce(${ps.totalVotes}, 0)::int`,
    })
    .from(bubbles)
    .leftJoin(ps, eq(ps.bubbleId, bubbles.id));
}

type BubbleSummaryRow = {
  bubble: typeof bubbles.$inferSelect;
  profileCount: number;
  avgAura: number | null;
  totalVotes: number;
};

export function toBubbleSummary(row: BubbleSummaryRow): BubbleSummary {
  const b = row.bubble;
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    kind: b.kind,
    badge: b.badge,
    logoUrl: b.logoUrl,
    lat: b.lat,
    lng: b.lng,
    countyName: b.countyName,
    stateName: b.stateName,
    population: b.population,
    memberCount: b.memberCount,
    profileCount: Number(row.profileCount ?? 0),
    avgAura: row.avgAura === null || row.avgAura === undefined ? null : roundTenth(Number(row.avgAura)),
    totalVotes: Number(row.totalVotes ?? 0),
    isOfficial: b.isOfficial,
  };
}

/* ── Misc helpers ──────────────────────────────────────────────────────── */

export function slugify(input: string): string {
  return (
    input
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "bubble"
  );
}

/** Escape LIKE wildcards in user search input. */
export function likePattern(q: string): string {
  return `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

export const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
