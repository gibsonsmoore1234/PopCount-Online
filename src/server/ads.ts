import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { adViews, ads, creditTransactions, users } from "@/lib/db/schema";
import { ApiError, badRequest, notFound } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Rewarded ads. No money changes hands: a viewer starts an ad (server records the start time),
 * watches it for its full duration, then claims — the server only grants clicks once the duration
 * has really elapsed, each view can be claimed once, and viewers are capped per day.
 */
export const AD_DAILY_LIMIT = 30;

export type AdDto = {
  id: string;
  title: string;
  advertiser: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  clickUrl: string | null;
  durationSeconds: number;
  rewardClicks: number;
};

const toDto = (a: typeof ads.$inferSelect): AdDto => ({
  id: a.id,
  title: a.title,
  advertiser: a.advertiser,
  mediaUrl: a.mediaUrl,
  mediaType: a.mediaType === "video" ? "video" : "image",
  clickUrl: a.clickUrl,
  durationSeconds: a.durationSeconds,
  rewardClicks: a.rewardClicks,
});

async function claimedToday(userId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(adViews)
    .where(and(eq(adViews.userId, userId), gt(adViews.claimedAt, sql`now() - interval '1 day'`)));
  return n;
}

/** Pick a random active ad and open a view for this viewer. */
export async function startAdView(user: SessionUser) {
  if ((await claimedToday(user.id)) >= AD_DAILY_LIMIT) {
    throw new ApiError(429, "You've watched the maximum ads for today — come back tomorrow.", "rate_limited");
  }
  const [ad] = await db
    .select()
    .from(ads)
    .where(eq(ads.isActive, true))
    .orderBy(sql`random()`)
    .limit(1);
  if (!ad) throw notFound("No ads are available right now — check back soon.");
  const [view] = await db.insert(adViews).values({ adId: ad.id, userId: user.id }).returning({ id: adViews.id });
  await db
    .update(ads)
    .set({ impressions: sql`${ads.impressions} + 1` })
    .where(eq(ads.id, ad.id));
  return { viewId: view.id, ad: toDto(ad) };
}

/** Grant the reward once the ad's full duration has elapsed since the view started. */
export async function claimAdView(user: SessionUser, viewId: string) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ view: adViews, ad: ads })
      .from(adViews)
      .innerJoin(ads, eq(ads.id, adViews.adId))
      .where(and(eq(adViews.id, viewId), eq(adViews.userId, user.id)))
      .for("update")
      .limit(1);
    if (!row) throw notFound("Ad view not found.");
    if (row.view.claimedAt) throw badRequest("This ad was already claimed.");
    const elapsed = (Date.now() - row.view.startedAt.getTime()) / 1000;
    if (elapsed < row.ad.durationSeconds - 0.5) {
      throw new ApiError(425, "Watch the whole ad to get your clicks.", "too_early");
    }
    const claimed = await tx
      .update(adViews)
      .set({ claimedAt: new Date() })
      .where(and(eq(adViews.id, viewId), isNull(adViews.claimedAt)))
      .returning({ id: adViews.id });
    if (claimed.length === 0) throw badRequest("This ad was already claimed.");
    await tx.insert(creditTransactions).values({
      userId: user.id,
      amount: row.ad.rewardClicks,
      reason: "AD_REWARD",
      reference: viewId,
    });
    const [u] = await tx
      .update(users)
      .set({ creditBalance: sql`${users.creditBalance} + ${row.ad.rewardClicks}` })
      .where(eq(users.id, user.id))
      .returning({ b: users.creditBalance });
    await tx
      .update(ads)
      .set({ completions: sql`${ads.completions} + 1` })
      .where(eq(ads.id, row.ad.id));
    return { creditBalance: u.b, granted: row.ad.rewardClicks };
  });
}

/* ── Admin: manage ad inventory ─────────────────────────────────────────── */
export async function listAds() {
  return (await db.select().from(ads).orderBy(desc(ads.createdAt))).map((a) => ({
    ...toDto(a),
    isActive: a.isActive,
    impressions: a.impressions,
    completions: a.completions,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function createAd(input: {
  title: string;
  advertiser: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  clickUrl?: string;
  durationSeconds: number;
  rewardClicks: number;
}) {
  const [a] = await db
    .insert(ads)
    .values({ ...input, clickUrl: input.clickUrl ?? null })
    .returning();
  return toDto(a);
}

export async function updateAd(id: string, patch: { isActive?: boolean }) {
  const [a] = await db.update(ads).set(patch).where(eq(ads.id, id)).returning({ id: ads.id });
  if (!a) throw notFound("Ad not found.");
  return { ok: true };
}

export async function deleteAd(id: string) {
  await db.delete(ads).where(eq(ads.id, id));
  return { ok: true };
}
