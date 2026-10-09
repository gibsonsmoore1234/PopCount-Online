import { and, asc, desc, eq, gt, gte, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { bubbles, profiles, ratings, users, voteEvents } from "@/lib/db/schema";
import { badRequest, conflict, forbidden, isUniqueViolation, notFound } from "@/lib/errors";
import { cleanUserText, containsBlockedLanguage } from "@/lib/moderation";
import { MIN_VOTES_FOR_RANKING, percentileBadge, roundTenth } from "@/lib/aura";
import type { CreateProfileInput, FeedSort, LeaderboardId, UpdateProfileInput } from "@/lib/validation";
import type { Page, ProfileCard, ProfileDetail, RankedProfile, SearchResults, Sticker } from "@/types/api";
import type { SessionUser } from "@/lib/auth/session";
import {
  bubbleSummaryQuery,
  cardQuery,
  likePattern,
  profileCardColumns,
  toBubbleSummary,
  toCard,
  visibleProfile,
} from "./shared";
import { addMember } from "./bubbles";
import { assertOwnImage } from "./images";

const eligible = gte(profiles.voteCount, MIN_VOTES_FOR_RANKING);

/* ── Create / update / delete (owner-only: profiles are strictly opt-in) ── */

export async function createProfile(user: SessionUser, input: CreateProfileInput) {
  if (containsBlockedLanguage(input.displayName)) throw badRequest("Pick a display name without profanity.");
  const [bubble] = await db
    .select({ id: bubbles.id, slug: bubbles.slug })
    .from(bubbles)
    .where(and(eq(bubbles.id, input.bubbleId), eq(bubbles.isHidden, false)))
    .limit(1);
  if (!bubble) throw badRequest("Choose an existing campus or town bubble.");
  await assertOwnImage(user.id, input.photoUrl);

  try {
    return await db.transaction(async (tx) => {
      const [profile] = await tx
        .insert(profiles)
        .values({
          userId: user.id,
          bubbleId: bubble.id,
          displayName: input.displayName,
          gender: input.gender,
          affiliation: input.affiliation ? cleanUserText(input.affiliation) : null,
          bio: cleanUserText(input.bio ?? ""),
          photoUrl: input.photoUrl,
        })
        .returning({ id: profiles.id });
      await addMember(tx, bubble.id, user.id);
      return { id: profile.id, bubbleSlug: bubble.slug };
    });
  } catch (err) {
    if (isUniqueViolation(err, "profiles_user_key")) {
      throw conflict("You already have a profile — edit it instead.");
    }
    throw err;
  }
}

async function loadOwned(user: SessionUser, profileId: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
  if (!row) throw notFound("Profile not found.");
  if (row.userId !== user.id && user.role !== "ADMIN") throw forbidden("You can only change your own profile.");
  return row;
}

export async function updateProfile(user: SessionUser, profileId: string, input: UpdateProfileInput) {
  const existing = await loadOwned(user, profileId);
  if (input.displayName && containsBlockedLanguage(input.displayName)) {
    throw badRequest("Pick a display name without profanity.");
  }
  if (input.photoUrl) await assertOwnImage(existing.userId, input.photoUrl);
  if (input.bubbleId && input.bubbleId !== existing.bubbleId) {
    const [b] = await db
      .select({ id: bubbles.id })
      .from(bubbles)
      .where(and(eq(bubbles.id, input.bubbleId), eq(bubbles.isHidden, false)))
      .limit(1);
    if (!b) throw badRequest("Choose an existing campus or town bubble.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.gender !== undefined && { gender: input.gender }),
        ...(input.affiliation !== undefined && {
          affiliation: input.affiliation ? cleanUserText(input.affiliation) : null,
        }),
        ...(input.bio !== undefined && { bio: cleanUserText(input.bio) }),
        ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl }),
        ...(input.bubbleId !== undefined && { bubbleId: input.bubbleId }),
        updatedAt: new Date(),
      })
      .where(eq(profiles.id, profileId));
    if (input.bubbleId && input.bubbleId !== existing.bubbleId) await addMember(tx, input.bubbleId, existing.userId);
  });
  return { id: profileId };
}

export async function deleteProfile(user: SessionUser, profileId: string) {
  await loadOwned(user, profileId);
  await db.delete(profiles).where(eq(profiles.id, profileId));
  return { deleted: true };
}

/* ── Read ──────────────────────────────────────────────────────────────── */

export async function getProfileDetail(profileId: string, viewer: SessionUser | null): Promise<ProfileDetail | null> {
  const [row] = await db
    .select({
      card: profileCardColumns,
      userId: profiles.userId,
      bubbleId: profiles.bubbleId,
      bio: profiles.bio,
      raterCount: profiles.raterCount,
      generalCount: profiles.commentCount,
      adviceCount: profiles.adviceCount,
      createdAt: profiles.createdAt,
      isHidden: profiles.isHidden,
      bannedAt: users.bannedAt,
    })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .innerJoin(bubbles, eq(bubbles.id, profiles.bubbleId))
    .where(eq(profiles.id, profileId))
    .limit(1);
  if (!row) return null;

  const isOwner = viewer?.id === row.userId;
  const isAdmin = viewer?.role === "ADMIN";
  if ((row.isHidden || row.bannedAt) && !isOwner && !isAdmin) return null;

  const card = toCard(row.card);
  const [rank, stickers, myRating] = await Promise.all([
    nationalRank(card.auraScore, card.voteCount),
    bubbleStickers(row.bubbleId, card.id),
    viewer ? getMyRating(viewer.id, card.id) : Promise.resolve(null),
  ]);
  const badge = rank.rank ? percentileBadge(rank.rank, rank.total) : null;
  if (badge) stickers.push({ ...badge, tone: badge.id === "bottom-10" ? "low" : "high" });

  return {
    ...card,
    userId: row.userId,
    bio: row.bio,
    raterCount: row.raterCount,
    generalCount: row.generalCount,
    adviceCount: row.adviceCount,
    createdAt: row.createdAt.toISOString(),
    isHidden: row.isHidden,
    isOwner,
    nationalRank: rank.rank,
    nationalEligible: rank.total,
    stickers,
    myRating,
  };
}

async function nationalRank(score: number | null, votes: number) {
  const base = and(visibleProfile, eligible);
  const [{ total }] = await countProfiles(base);
  if (score === null || votes < MIN_VOTES_FOR_RANKING) return { rank: null, total };
  const [{ total: above }] = await countProfiles(
    and(base, gt(sql`round(${profiles.auraScore}::numeric, 1)`, roundTenth(score))),
  );
  return { rank: above + 1, total };
}

function countProfiles(where: SQL | undefined) {
  return db
    .select({ total: sql<number>`count(*)::int`.mapWith(Number) })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .innerJoin(bubbles, eq(bubbles.id, profiles.bubbleId))
    .where(where);
}

/** Bubble-level stickers: Most Known (most votes), Most AURA (highest), Least AURA (lowest). */
async function bubbleStickers(bubbleId: string, profileId: string): Promise<Sticker[]> {
  const inBubble = and(visibleProfile, eq(profiles.bubbleId, bubbleId));
  const pick = (where: SQL | undefined, ...order: SQL[]) =>
    db
      .select({ id: profiles.id })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .innerJoin(bubbles, eq(bubbles.id, profiles.bubbleId))
      .where(where)
      .orderBy(...order)
      .limit(1);

  const [[known], [most], [least], [{ total: n }]] = await Promise.all([
    pick(and(inBubble, gt(profiles.voteCount, 0)), desc(profiles.voteCount), desc(profiles.auraScore)),
    pick(and(inBubble, eligible), desc(profiles.auraScore), desc(profiles.voteCount)),
    pick(and(inBubble, eligible), asc(profiles.auraScore), desc(profiles.voteCount)),
    countProfiles(and(inBubble, eligible)),
  ]);

  const out: Sticker[] = [];
  if (known?.id === profileId) out.push({ id: "most-known", label: "Most Known", tone: "ink" });
  if (n >= 3 && most?.id === profileId) out.push({ id: "most-aura", label: "Most Popular", tone: "high" });
  if (n >= 3 && least?.id === profileId) out.push({ id: "least-aura", label: "Least Popular", tone: "low" });
  return out;
}

export async function getMyRating(userId: string, profileId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [[rating], [{ boosts }]] = await Promise.all([
    db
      .select({ value: ratings.value, weight: ratings.weight })
      .from(ratings)
      .where(and(eq(ratings.profileId, profileId), eq(ratings.raterId, userId)))
      .limit(1),
    db
      .select({ boosts: sql<number>`coalesce(sum(${voteEvents.weight}), 0)::int` })
      .from(voteEvents)
      .where(
        and(
          eq(voteEvents.raterId, userId),
          eq(voteEvents.profileId, profileId),
          eq(voteEvents.kind, "BOOST"),
          gt(voteEvents.createdAt, since),
        ),
      ),
  ]);
  if (!rating) return null;
  return { value: rating.value, weight: rating.weight, boostsToday: Number(boosts) };
}

/* ── Campus feed ───────────────────────────────────────────────────────── */

const auraDescNullsLast = sql`${profiles.auraScore} desc nulls last`;
const auraAscNullsLast = sql`${profiles.auraScore} asc nulls last`;

export async function campusFeed(
  bubbleId: string,
  opts: { sort: FeedSort; q?: string; cursor: number; limit: number },
): Promise<Page<ProfileCard>> {
  const filters: (SQL | undefined)[] = [visibleProfile, eq(profiles.bubbleId, bubbleId)];
  if (opts.sort === "males") filters.push(eq(profiles.gender, "MALE"));
  if (opts.sort === "females") filters.push(eq(profiles.gender, "FEMALE"));
  if (opts.q) {
    const pattern = likePattern(opts.q);
    filters.push(
      or(
        sql`lower(${profiles.displayName}) like ${pattern}`,
        sql`lower(${users.handle}) like ${pattern}`,
        sql`lower(coalesce(${profiles.affiliation}, '')) like ${pattern}`,
      ),
    );
  }

  const order: SQL[] = {
    best: [auraDescNullsLast, desc(profiles.voteCount)],
    males: [auraDescNullsLast, desc(profiles.voteCount)],
    females: [auraDescNullsLast, desc(profiles.voteCount)],
    lowest: [auraAscNullsLast, desc(profiles.voteCount)],
    most_votes: [desc(profiles.voteCount), auraDescNullsLast],
    least_votes: [asc(profiles.voteCount), auraDescNullsLast],
  }[opts.sort];

  const rows = await cardQuery()
    .where(and(...filters))
    .orderBy(...order, asc(profiles.id))
    .limit(opts.limit + 1)
    .offset(opts.cursor);

  const items = rows.slice(0, opts.limit).map(toCard);
  return { items, nextCursor: rows.length > opts.limit ? opts.cursor + opts.limit : null };
}

/* ── Leaderboards ──────────────────────────────────────────────────────── */

const BOARD_LIMITS: Record<"national" | "bubble", Record<LeaderboardId, number>> = {
  national: { top_overall: 50, bottom_overall: 50, top_males: 100, top_females: 100 },
  bubble: { top_overall: 25, bottom_overall: 25, top_males: 50, top_females: 50 },
};

/**
 * Local:    Top 50 Males / Top 50 Females (vote volume), Top 25 / Bottom 25 Overall (score).
 * National: Top 100 Males / Top 100 Females (vote volume), Top 50 / Bottom 50 Overall (score).
 */
export async function leaderboard(board: LeaderboardId, bubbleId?: string): Promise<RankedProfile[]> {
  const scope = bubbleId ? "bubble" : "national";
  const limit = BOARD_LIMITS[scope][board];
  const filters: (SQL | undefined)[] = [visibleProfile, bubbleId ? eq(profiles.bubbleId, bubbleId) : undefined];
  let order: SQL[];
  switch (board) {
    case "top_overall":
      filters.push(eligible, isNotNull(profiles.auraScore));
      order = [desc(profiles.auraScore), desc(profiles.voteCount)];
      break;
    case "bottom_overall":
      filters.push(eligible, isNotNull(profiles.auraScore));
      order = [asc(profiles.auraScore), desc(profiles.voteCount)];
      break;
    case "top_males":
      filters.push(eq(profiles.gender, "MALE"), gt(profiles.voteCount, 0));
      order = [desc(profiles.voteCount), auraDescNullsLast];
      break;
    case "top_females":
      filters.push(eq(profiles.gender, "FEMALE"), gt(profiles.voteCount, 0));
      order = [desc(profiles.voteCount), auraDescNullsLast];
      break;
  }
  const rows = await cardQuery()
    .where(and(...filters))
    .orderBy(...order, asc(profiles.id))
    .limit(limit);
  return rows.map((r, i) => ({ ...toCard(r), rank: i + 1 }));
}

/* ── Search ────────────────────────────────────────────────────────────── */

export async function search(q: string): Promise<SearchResults> {
  const pattern = likePattern(q.replace(/^@/, ""));
  const rankExpr = sql<number | null>`case when ${profiles.voteCount} >= ${MIN_VOTES_FOR_RANKING} then (
      select count(*)::int + 1 from ${profiles} p2
      join ${users} u2 on u2.id = p2.user_id
      join ${bubbles} b2 on b2.id = p2.bubble_id
      where p2.is_hidden = false and b2.is_hidden = false and u2.banned_at is null
        and p2.vote_count >= ${MIN_VOTES_FOR_RANKING}
        and round(p2.aura_score::numeric, 1) > round(${profiles.auraScore}::numeric, 1)
    ) else null end`;

  const [profileRows, bubbleRows] = await Promise.all([
    db
      .select({ card: profileCardColumns, rank: rankExpr })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .innerJoin(bubbles, eq(bubbles.id, profiles.bubbleId))
      .where(
        and(
          visibleProfile,
          or(sql`lower(${profiles.displayName}) like ${pattern}`, sql`lower(${users.handle}) like ${pattern}`),
        ),
      )
      .orderBy(desc(profiles.voteCount))
      .limit(8),
    bubbleSummaryQuery()
      .where(
        and(
          eq(bubbles.isHidden, false),
          or(
            sql`lower(${bubbles.name}) like ${pattern}`,
            sql`lower(${bubbles.countyName}) like ${pattern}`,
            sql`lower(${bubbles.stateName}) like ${pattern}`,
            sql`lower(coalesce(${bubbles.badge}, '')) like ${pattern}`,
          ),
        ),
      )
      .orderBy(desc(bubbles.memberCount))
      .limit(6),
  ]);

  return {
    profiles: profileRows.map((r) => ({ ...toCard(r.card), rank: r.rank === null ? 0 : Number(r.rank) })),
    bubbles: bubbleRows.map(toBubbleSummary),
  };
}

/** The signed-in user's own profile id, if any. */
export async function profileIdForUser(userId: string) {
  const [row] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return row?.id ?? null;
}
