import { and, eq, gt, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { creditTransactions, profiles, ratings, users, voteEvents } from "@/lib/db/schema";
import { badRequest, notFound, paymentRequired, tooMany } from "@/lib/errors";
import { BOOST_COST_CENTS, BOOST_DAILY_CAP, UP_THRESHOLD, computeAura } from "@/lib/aura";
import type { SessionUser } from "@/lib/auth/session";
import type { VoteResult } from "@/types/api";

/** Lock the profile row so concurrent votes on the same profile serialise their aggregate updates. */
async function lockProfile(tx: Tx, profileId: string) {
  const [p] = await tx
    .select({ id: profiles.id, userId: profiles.userId, bubbleId: profiles.bubbleId, isHidden: profiles.isHidden })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .for("update")
    .limit(1);
  if (!p || p.isHidden) throw notFound("Profile not found.");
  return p;
}

/** Recompute the denormalised Aura aggregates from the ratings table (source of truth). */
export async function recomputeAggregates(tx: Tx, profileId: string) {
  const [agg] = await tx
    .select({
      sum: sql<number>`coalesce(sum(${ratings.value} * ${ratings.weight}), 0)::int`.mapWith(Number),
      votes: sql<number>`coalesce(sum(${ratings.weight}), 0)::int`.mapWith(Number),
      up: sql<number>`coalesce(sum(${ratings.weight}) filter (where ${ratings.value} >= ${UP_THRESHOLD}), 0)::int`.mapWith(
        Number,
      ),
      down: sql<number>`coalesce(sum(${ratings.weight}) filter (where ${ratings.value} < ${UP_THRESHOLD}), 0)::int`.mapWith(
        Number,
      ),
      raters: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(ratings)
    .where(eq(ratings.profileId, profileId));

  const auraScore = computeAura(agg.sum, agg.votes);
  await tx
    .update(profiles)
    .set({
      ratingSum: agg.sum,
      voteCount: agg.votes,
      upCount: agg.up,
      downCount: agg.down,
      raterCount: agg.raters,
      auraScore,
    })
    .where(eq(profiles.id, profileId));
  return { auraScore, voteCount: agg.votes, upCount: agg.up, downCount: agg.down, raterCount: agg.raters };
}

async function boostsInLastDay(tx: Tx, raterId: string, profileId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ n }] = await tx
    .select({ n: sql<number>`coalesce(sum(${voteEvents.weight}), 0)::int`.mapWith(Number) })
    .from(voteEvents)
    .where(
      and(
        eq(voteEvents.raterId, raterId),
        eq(voteEvents.profileId, profileId),
        eq(voteEvents.kind, "BOOST"),
        gt(voteEvents.createdAt, since),
      ),
    );
  return n;
}

async function balanceOf(tx: Tx, userId: string) {
  const [u] = await tx.select({ b: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.b ?? 0;
}

/**
 * Submit (or change) the viewer's free Aura rating for a profile: one rating per person per profile.
 * Quick votes map to the extremes — 🔥 = 100, 👎 = 0 — so Aura is always a plain weighted mean.
 */
export async function rateProfile(user: SessionUser, profileId: string, value: number): Promise<VoteResult> {
  return db.transaction(async (tx) => {
    const p = await lockProfile(tx, profileId);
    const [row] = await tx
      .insert(ratings)
      .values({ profileId, raterId: user.id, value, weight: 1 })
      .onConflictDoUpdate({
        target: [ratings.profileId, ratings.raterId],
        set: { value, updatedAt: new Date() },
      })
      .returning({ value: ratings.value, weight: ratings.weight });
    await tx.insert(voteEvents).values({
      profileId,
      bubbleId: p.bubbleId,
      raterId: user.id,
      kind: "RATE",
      value,
      weight: 1,
    });
    const agg = await recomputeAggregates(tx, profileId);
    return {
      profile: { id: profileId, ...agg },
      myRating: { value: row.value, weight: row.weight, boostsToday: await boostsInLastDay(tx, user.id, profileId) },
      creditBalance: await balanceOf(tx, user.id),
    };
  });
}

/**
 * Spend boost credits ($0.01 per click) to add weight to the viewer's existing rating.
 * Capped at BOOST_DAILY_CAP clicks per profile per rolling 24 hours to keep rankings meaningful.
 */
export async function boostProfile(user: SessionUser, profileId: string, clicks: number): Promise<VoteResult> {
  return db.transaction(async (tx) => {
    const p = await lockProfile(tx, profileId);
    const [rating] = await tx
      .select({ value: ratings.value, weight: ratings.weight })
      .from(ratings)
      .where(and(eq(ratings.profileId, profileId), eq(ratings.raterId, user.id)))
      .limit(1);
    if (!rating) throw badRequest("Rate them first — boosts amplify your rating.");

    const used = await boostsInLastDay(tx, user.id, profileId);
    const remaining = BOOST_DAILY_CAP - used;
    if (remaining <= 0) throw tooMany(`Daily boost cap reached (${BOOST_DAILY_CAP} clicks per profile per 24h).`);
    const applied = Math.min(clicks, remaining);
    const cost = applied * BOOST_COST_CENTS;

    // Atomic conditional debit — the CHECK constraint is the final backstop against overdraft.
    const debited = await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} - ${cost}` })
      .where(and(eq(users.id, user.id), sql`${users.creditBalance} >= ${cost}`))
      .returning({ balance: users.creditBalance });
    if (debited.length === 0) throw paymentRequired("Not enough boost credit — top up to keep boosting.");

    await tx
      .insert(creditTransactions)
      .values({ userId: user.id, amount: -cost, reason: "BOOST", reference: profileId });
    const [updated] = await tx
      .update(ratings)
      .set({ weight: sql`${ratings.weight} + ${applied}`, updatedAt: new Date() })
      .where(and(eq(ratings.profileId, profileId), eq(ratings.raterId, user.id)))
      .returning({ value: ratings.value, weight: ratings.weight });
    await tx.insert(voteEvents).values({
      profileId,
      bubbleId: p.bubbleId,
      raterId: user.id,
      kind: "BOOST",
      value: rating.value,
      weight: applied,
    });
    const agg = await recomputeAggregates(tx, profileId);
    return {
      profile: { id: profileId, ...agg },
      myRating: { value: updated.value, weight: updated.weight, boostsToday: used + applied },
      creditBalance: debited[0].balance,
    };
  });
}
