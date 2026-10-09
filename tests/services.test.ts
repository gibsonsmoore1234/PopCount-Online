/**
 * Integration tests: the real service layer against a real (in-memory) Postgres via PGlite,
 * with the production migrations applied.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { createDb, setDb, type Db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { createBubble, getBubbleBySlug } from "@/server/bubbles";
import { createProfile, getProfileDetail, leaderboard } from "@/server/profiles";
import { boostProfile, rateProfile } from "@/server/ratings";
import { addComment } from "@/server/comments";
import { createReport } from "@/server/reports";
import { grantPurchase, getBalance } from "@/server/credits";
import { ApiError } from "@/lib/errors";

let db: Db;
let n = 0;

async function makeUser(opts: { credits?: number } = {}): Promise<SessionUser> {
  n += 1;
  const [u] = await db
    .insert(s.users)
    .values({
      email: `u${n}@test.edu`,
      handle: `user_${n}`,
      passwordHash: "x",
      creditBalance: opts.credits ?? 250,
      termsAcceptedAt: new Date(),
    })
    .returning();
  return {
    id: u.id,
    email: u.email,
    handle: u.handle,
    role: u.role,
    isAnonymous: u.isAnonymous,
    creditBalance: u.creditBalance,
    termsAcceptedAt: u.termsAcceptedAt,
  };
}

async function makeProfile(user: SessionUser, bubbleId: string, gender: "MALE" | "FEMALE" = "FEMALE") {
  const p = await createProfile(user, {
    bubbleId,
    displayName: `Person ${user.handle}`,
    gender,
    bio: "",
    photoUrl: `/api/avatar/${user.handle}`,
    consent: true,
  });
  return p.id;
}

async function expectApiError(p: Promise<unknown>, status: number) {
  await expect(p).rejects.toBeInstanceOf(ApiError);
  await p.catch((e: ApiError) => expect(e.status).toBe(status));
}

let duke: string;

beforeAll(async () => {
  const handle = createDb({ pgliteDir: "memory" });
  await migrate(handle.db as unknown as PgliteDatabase, { migrationsFolder: "drizzle" });
  setDb(handle);
  db = handle.db;
  const founder = await makeUser();
  const bubble = await createBubble(founder, {
    name: "Duke",
    description: "",
    kind: "CAMPUS",
    lat: 36.0014,
    lng: -78.9382,
  });
  duke = bubble.id;
});

describe("profiles", () => {
  it("allows exactly one (self-owned) profile per account", async () => {
    const u = await makeUser();
    await makeProfile(u, duke);
    await expectApiError(makeProfile(u, duke), 409);
  });

  it("joins the owner to the bubble and counts members", async () => {
    const before = (await getBubbleBySlug("duke"))!.memberCount;
    await makeProfile(await makeUser(), duke);
    expect((await getBubbleBySlug("duke"))!.memberCount).toBe(before + 1);
  });
});

describe("Aura rating engine", () => {
  it("computes the mean of all ratings and lets a rater change their vote", async () => {
    const owner = await makeUser();
    const pid = await makeProfile(owner, duke);
    const raters = await Promise.all([45, 88, 20, 77, 90].map(() => makeUser()));
    const values = [45, 88, 20, 77, 90];
    for (let i = 0; i < raters.length; i++) await rateProfile(raters[i], pid, values[i]);

    let p = (await getProfileDetail(pid, null))!;
    expect(p.auraScore).toBe(64);
    expect(p.voteCount).toBe(5);
    expect(p.upCount).toBe(3); // 88, 77, 90
    expect(p.downCount).toBe(2); // 45, 20

    // Rater 3 changes 20 → 100: (45+88+100+77+90)/5 = 80
    await rateProfile(raters[2], pid, 100);
    p = (await getProfileDetail(pid, null))!;
    expect(p.auraScore).toBe(80);
    expect(p.voteCount).toBe(5);
    expect(p.raterCount).toBe(5);
  });

  it("forbids rating yourself", async () => {
    const owner = await makeUser();
    const pid = await makeProfile(owner, duke);
    await expectApiError(rateProfile(owner, pid, 100), 403);
  });
});

describe("boost micro-economy", () => {
  it("requires a rating, debits $0.01 per click and adds weight", async () => {
    const pid = await makeProfile(await makeUser(), duke);
    const fan = await makeUser({ credits: 250 });
    const hater = await makeUser();
    await expectApiError(boostProfile(fan, pid, 1), 400);

    await rateProfile(fan, pid, 100);
    await rateProfile(hater, pid, 0);
    const res = await boostProfile(fan, pid, 3);
    // 100×4 + 0×1 over weight 5 = 80
    expect(res.profile.auraScore).toBe(80);
    expect(res.myRating.weight).toBe(4);
    expect(res.creditBalance).toBe(247);
    expect(await getBalance(fan.id)).toBe(247);
  });

  it("caps boosts at 10 per profile per day", async () => {
    const pid = await makeProfile(await makeUser(), duke);
    const fan = await makeUser({ credits: 1000 });
    await rateProfile(fan, pid, 90);
    const first = await boostProfile(fan, pid, 8);
    expect(first.myRating.boostsToday).toBe(8);
    const second = await boostProfile(fan, pid, 10); // clamped to the 2 remaining
    expect(second.myRating.boostsToday).toBe(10);
    expect(second.creditBalance).toBe(990);
    await expectApiError(boostProfile(fan, pid, 1), 429);
  });

  it("refuses to overdraw credits", async () => {
    const pid = await makeProfile(await makeUser(), duke);
    const broke = await makeUser({ credits: 1 });
    await rateProfile(broke, pid, 70);
    await expectApiError(boostProfile(broke, pid, 2), 402);
    expect(await getBalance(broke.id)).toBe(1);
  });

  it("grants each purchase exactly once (idempotent webhooks)", async () => {
    const buyer = await makeUser({ credits: 0 });
    expect(await grantPurchase(buyer.id, 550, "cs_test_123")).toBe(true);
    expect(await grantPurchase(buyer.id, 550, "cs_test_123")).toBe(false);
    expect(await getBalance(buyer.id)).toBe(550);
  });
});

describe("leaderboards", () => {
  it("only ranks overall/bottom boards once a profile has 3+ votes, and ranks gender boards by volume", async () => {
    const quiet = await makeProfile(await makeUser(), duke, "MALE");
    const busy = await makeProfile(await makeUser(), duke, "MALE");
    await rateProfile(await makeUser(), quiet, 5); // 1 vote → not eligible for Bottom
    for (let i = 0; i < 4; i++) await rateProfile(await makeUser(), busy, 60);

    const bottom = await leaderboard("bottom_overall", duke);
    expect(bottom.find((p) => p.id === quiet)).toBeUndefined();
    expect(bottom.find((p) => p.id === busy)).toBeDefined();

    const males = await leaderboard("top_males", duke);
    const iBusy = males.findIndex((p) => p.id === busy);
    const iQuiet = males.findIndex((p) => p.id === quiet);
    expect(iBusy).toBeGreaterThanOrEqual(0);
    expect(iBusy).toBeLessThan(iQuiet);
    expect(males.every((p) => p.gender === "MALE")).toBe(true);
  });
});

describe("bubbles", () => {
  it("rejects pins outside the United States", async () => {
    await expectApiError(
      createBubble(await makeUser(), { name: "Atlantis", description: "", kind: "TOWN", lat: 30, lng: -60 }),
      400,
    );
  });

  it("enforces the 100-bubbles-per-county cap", async () => {
    const admin = { ...(await makeUser()), role: "ADMIN" as const };
    const rows = Array.from({ length: 100 }, (_, i) => ({
      slug: `travis-${i}`,
      name: `Travis ${i}`,
      lat: 30.28,
      lng: -97.73,
      countyFips: "48453",
      countyName: "Travis",
      stateName: "Texas",
    }));
    await db.insert(s.bubbles).values(rows);
    await expectApiError(
      createBubble(admin, { name: "One Too Many", description: "", kind: "TOWN", lat: 30.2849, lng: -97.7341 }),
      409,
    );
  });
});

describe("trust & safety", () => {
  it("auto-hides a comment after 3 distinct reports and keeps counters in sync", async () => {
    const owner = await makeUser();
    const pid = await makeProfile(owner, duke);
    const troll = await makeUser();
    const comment = await addComment(troll, pid, "COMMENT", "this is a rude comment");
    expect((await getProfileDetail(pid, null))!.generalCount).toBe(1);

    for (let i = 0; i < 3; i++) {
      await createReport(await makeUser(), {
        targetType: "COMMENT",
        targetId: comment.id,
        reason: "harassment",
        details: "",
      });
    }
    const [row] = await db.select().from(s.comments).where(eq(s.comments.id, comment.id));
    expect(row.isHidden).toBe(true);
    expect((await getProfileDetail(pid, null))!.generalCount).toBe(0);
  });

  it("censors profanity in comments", async () => {
    const pid = await makeProfile(await makeUser(), duke);
    const c = await addComment(await makeUser(), pid, "COMMENT", "what the fuck");
    expect(c.body).not.toContain("fuck");
  });
});
