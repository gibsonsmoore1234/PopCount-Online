import { and, count, eq, gt, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/lib/db";
import { bubbleMembers, bubbles, groups, profiles, voteEvents } from "@/lib/db/schema";
import { badRequest, conflict, notFound, tooMany } from "@/lib/errors";
import { containsBlockedLanguage, cleanUserText } from "@/lib/moderation";
import { lookupCounty, MAX_BUBBLES_PER_COUNTY } from "@/lib/geo/county";
import type { CreateBubbleInput } from "@/lib/validation";
import type { BubbleSort } from "@/lib/validation";
import type { BubbleRankingEntry, BubbleSummary } from "@/types/api";
import type { SessionUser } from "@/lib/auth/session";
import { bubbleSummaryQuery, slugify, toBubbleSummary } from "./shared";
import { assertOwnImage } from "./images";
import { spendClick } from "./credits";

const MAX_BUBBLES_PER_USER_PER_DAY = 5;

export async function listBubbles(): Promise<BubbleSummary[]> {
  const rows = await bubbleSummaryQuery().where(eq(bubbles.isHidden, false)).orderBy(bubbles.name);
  return rows.map(toBubbleSummary);
}

export async function getBubbleBySlug(slug: string, opts: { includeHidden?: boolean } = {}) {
  const [row] = await bubbleSummaryQuery()
    .where(opts.includeHidden ? eq(bubbles.slug, slug) : and(eq(bubbles.slug, slug), eq(bubbles.isHidden, false)))
    .limit(1);
  return row ? toBubbleSummary(row) : null;
}

export async function requireBubble(slug: string) {
  const bubble = await getBubbleBySlug(slug);
  if (!bubble) throw notFound("That bubble doesn't exist (or was removed).");
  return bubble;
}

/** Global bubble leaderboard: Most Active (weighted votes in the last 7 days), Highest/Lowest Avg %, Total Votes. */
export async function bubbleRankings(sort: BubbleSort): Promise<BubbleRankingEntry[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [all, activity] = await Promise.all([
    listBubbles(),
    db
      .select({ bubbleId: voteEvents.bubbleId, votes: sql<number>`coalesce(sum(${voteEvents.weight}), 0)::int` })
      .from(voteEvents)
      .where(gt(voteEvents.createdAt, since))
      .groupBy(voteEvents.bubbleId),
  ]);
  const recent = new Map(activity.map((a) => [a.bubbleId, Number(a.votes)]));
  let list = all.map((b) => ({ ...b, recentVotes: recent.get(b.id) ?? 0 }));

  const byAvg = (dir: 1 | -1) => (a: (typeof list)[number], b: (typeof list)[number]) =>
    dir * ((a.avgAura ?? 0) - (b.avgAura ?? 0)) || b.totalVotes - a.totalVotes;

  switch (sort) {
    case "active":
      list.sort(
        (a, b) => b.recentVotes - a.recentVotes || b.memberCount - a.memberCount || b.totalVotes - a.totalVotes,
      );
      break;
    case "highest":
      list = list.filter((b) => b.avgAura !== null).sort(byAvg(-1));
      break;
    case "lowest":
      list = list.filter((b) => b.avgAura !== null).sort(byAvg(1));
      break;
    case "votes":
      list.sort((a, b) => b.totalVotes - a.totalVotes || b.memberCount - a.memberCount);
      break;
  }
  return list.slice(0, 100).map((b, i) => ({ ...b, rank: i + 1 }));
}

export async function createBubble(user: SessionUser, input: CreateBubbleInput) {
  if (containsBlockedLanguage(input.name) || containsBlockedLanguage(input.badge ?? "")) {
    throw badRequest("Pick a bubble name without profanity.");
  }
  const county = lookupCounty(input.lat, input.lng);
  if (!county) throw badRequest("Bubbles must be pinned on land inside the United States.");
  if (input.logoUrl) await assertOwnImage(user.id, input.logoUrl);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [{ value: recentByUser }] = await db
    .select({ value: count() })
    .from(bubbles)
    .where(and(eq(bubbles.createdById, user.id), gt(bubbles.createdAt, since)));
  if (user.role !== "ADMIN" && Number(recentByUser) >= MAX_BUBBLES_PER_USER_PER_DAY) {
    throw tooMany(`You can create up to ${MAX_BUBBLES_PER_USER_PER_DAY} bubbles per day.`);
  }

  return db.transaction(async (tx) => {
    // Serialise inserts per county so the cap can't be raced past.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"county:" + county.fips}))`);
    const [{ value: inCounty }] = await tx
      .select({ value: count() })
      .from(bubbles)
      .where(eq(bubbles.countyFips, county.fips));
    if (Number(inCounty) >= MAX_BUBBLES_PER_COUNTY) {
      throw conflict(`${county.county} County already has the maximum of ${MAX_BUBBLES_PER_COUNTY} bubbles.`);
    }

    // Pins can't stack on identical coordinates (≈1 m precision).
    const [dupe] = await tx
      .select({ id: bubbles.id })
      .from(bubbles)
      .where(
        sql`round(${bubbles.lat}::numeric, 5) = round(${input.lat}::numeric, 5) and round(${bubbles.lng}::numeric, 5) = round(${input.lng}::numeric, 5)`,
      )
      .limit(1);
    if (dupe) throw conflict("Another bubble already sits on exactly this spot — move your pin slightly.");

    const slug = await uniqueSlug(tx, slugify(input.name));
    const [bubble] = await tx
      .insert(bubbles)
      .values({
        slug,
        name: input.name,
        description: cleanUserText(input.description ?? ""),
        kind: input.kind,
        badge: input.badge ?? null,
        logoUrl: input.logoUrl ?? null,
        lat: input.lat,
        lng: input.lng,
        countyFips: county.fips,
        countyName: county.county,
        stateName: county.state,
        createdById: user.id,
        memberCount: 0,
      })
      .returning();

    await tx.insert(groups).values({
      bubbleId: bubble.id,
      slug: "general",
      name: "general",
      description: `Everything ${bubble.name}.`,
      createdById: user.id,
    });
    await addMember(tx, bubble.id, user.id);
    await spendClick(tx, user.id, bubble.id);
    return bubble;
  });
}

async function uniqueSlug(tx: DbOrTx, base: string) {
  const taken = await tx
    .select({ slug: bubbles.slug })
    .from(bubbles)
    .where(sql`${bubbles.slug} = ${base} or ${bubbles.slug} like ${base + "-%"}`);
  const set = new Set(taken.map((t) => t.slug));
  if (!set.has(base)) return base;
  for (let i = 2; ; i++) if (!set.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function addMember(tx: DbOrTx, bubbleId: string, userId: string) {
  await tx.insert(bubbleMembers).values({ bubbleId, userId }).onConflictDoNothing();
  await refreshMemberCount(tx, bubbleId);
}

export async function refreshMemberCount(tx: DbOrTx, bubbleId: string) {
  await tx
    .update(bubbles)
    .set({
      memberCount: sql`(select count(*)::int from ${bubbleMembers} where ${bubbleMembers.bubbleId} = ${bubbleId})`,
    })
    .where(eq(bubbles.id, bubbleId));
}

export async function joinBubble(user: SessionUser, slug: string) {
  const bubble = await requireBubble(slug);
  await db.transaction((tx) => addMember(tx, bubble.id, user.id));
  return { joined: true };
}

export async function leaveBubble(user: SessionUser, slug: string) {
  const bubble = await requireBubble(slug);
  const [home] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.userId, user.id), eq(profiles.bubbleId, bubble.id)))
    .limit(1);
  if (home) throw badRequest("This is your profile's home bubble — move your profile before leaving.");
  await db.transaction(async (tx) => {
    await tx.delete(bubbleMembers).where(and(eq(bubbleMembers.bubbleId, bubble.id), eq(bubbleMembers.userId, user.id)));
    await refreshMemberCount(tx, bubble.id);
  });
  return { joined: false };
}

export async function isMember(userId: string, bubbleId: string) {
  const [row] = await db
    .select({ userId: bubbleMembers.userId })
    .from(bubbleMembers)
    .where(and(eq(bubbleMembers.bubbleId, bubbleId), eq(bubbleMembers.userId, userId)))
    .limit(1);
  return Boolean(row);
}
