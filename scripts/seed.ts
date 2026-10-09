/**
 * Demo data seeder.
 *
 *   npm run db:seed            seed (fails if data exists)
 *   npm run db:seed -- --if-empty   seed only when the database has no bubbles (used by `npm run dev`)
 *   npm run db:reset           wipe every table, then seed
 *
 * Every demo person is fictional and every profile is owned by its own (demo) account — the same
 * opt-in model real users follow. Photos are generated illustrations, not pictures of real people.
 */
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../src/lib/db";
import * as s from "../src/lib/db/schema";
import { hashPassword } from "../src/lib/auth/password";
import { lookupCounty } from "../src/lib/geo/county";
import { SIGNUP_GRANT_CENTS } from "../src/lib/aura";
import { loadEnvFile } from "./migrate";

loadEnvFile();

const args = new Set(process.argv.slice(2));
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "password123";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";

/* ── Deterministic randomness ──────────────────────────────────────────── */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261009);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const chance = (p: number) => rand() < p;
const gauss = () => {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* ── Demo content ──────────────────────────────────────────────────────── */
const CAMPUSES = [
  {
    slug: "ole-miss",
    name: "Ole Miss",
    badge: "The Grove",
    lat: 34.3647,
    lng: -89.5384,
    population: 24_000,
    description: "University of Mississippi undergrad & grad student body.",
    lurkers: 38,
    profiles: 12,
    orgs: [
      "Chi Omega",
      "Sigma Chi",
      "Delta Gamma",
      "Kappa Alpha",
      "Kappa Kappa Gamma",
      "Phi Delta Theta",
      "Tri Delta",
      "SAE",
      "Alpha Phi",
      "Pi Kappa Alpha",
      "Ole Miss Baseball",
      "Rebel Radio",
    ],
    groups: [
      ["game-day", "Grove tailgates, tickets and road trips."],
      ["the-square", "Where's everyone headed tonight?"],
    ],
  },
  {
    slug: "duke",
    name: "Duke",
    badge: "West Campus",
    lat: 36.0014,
    lng: -78.9382,
    population: 17_600,
    description: "Duke University undergrads, grads and Durham regulars.",
    lurkers: 30,
    profiles: 11,
    orgs: [
      "Pratt Engineering",
      "Kappa Alpha Theta",
      "Duke Chronicle",
      "Pi Beta Phi",
      "Sigma Nu",
      "Cameron Crazies",
      "Delta Delta Delta",
      "DukeEngage",
      "Alpha Delta Pi",
      "Duke Club Soccer",
    ],
    groups: [
      ["cameron-crazies", "K-ville tenting and game-day chaos."],
      ["study-hall", "Perkins seats, problem sets, coffee runs."],
    ],
  },
  {
    slug: "nyu",
    name: "NYU",
    badge: "Washington Sq",
    lat: 40.7295,
    lng: -73.9965,
    population: 59_000,
    description: "New York University across Washington Square and beyond.",
    lurkers: 26,
    profiles: 10,
    orgs: [
      "Tisch Drama",
      "Stern Finance Society",
      "Gallatin",
      "Alpha Epsilon Phi",
      "NYU Club Running",
      "WNYU Radio",
      "Steinhardt Music",
      "Delta Phi Epsilon",
    ],
    groups: [
      ["nightlife", "Where the city is tonight."],
      ["study-hall", "Bobst floors ranked."],
    ],
  },
  {
    slug: "ucla",
    name: "UCLA",
    badge: "Westwood",
    lat: 34.0689,
    lng: -118.4452,
    population: 47_000,
    description: "UCLA Bruins from Westwood to the Hill.",
    lurkers: 32,
    profiles: 11,
    orgs: [
      "Kappa Delta",
      "Bruin Surf Club",
      "Daily Bruin",
      "Sigma Pi",
      "Alpha Chi Omega",
      "Theta Xi",
      "UCLA Esports",
      "Bruin Dance Marathon",
      "Gamma Phi Beta",
    ],
    groups: [
      ["beach-days", "Santa Monica carpools."],
      ["game-day", "Rose Bowl Saturdays."],
    ],
  },
  {
    slug: "ut-austin",
    name: "UT Austin",
    badge: "40 Acres",
    lat: 30.2849,
    lng: -97.7341,
    population: 53_000,
    description: "Longhorns from West Campus to Sixth Street.",
    lurkers: 28,
    profiles: 10,
    orgs: [
      "Zeta Tau Alpha",
      "Texas Cowboys",
      "Delta Tau Delta",
      "Kappa Alpha Theta",
      "Longhorn Band",
      "McCombs BBA",
      "Phi Gamma Delta",
      "Texas Spirits",
    ],
    groups: [
      ["game-day", "DKR Saturdays."],
      ["sixth-street", "Plans for the weekend."],
    ],
  },
  {
    slug: "umiami",
    name: "UMiami",
    badge: "Coral Gables",
    lat: 25.7215,
    lng: -80.2793,
    population: 19_000,
    description: "University of Miami — The U in Coral Gables.",
    lurkers: 22,
    profiles: 10,
    orgs: [
      "Delta Gamma",
      "Sigma Alpha Mu",
      "Herbert Business",
      "Alpha Delta Pi",
      "Hurricane Sailing",
      "Frost Music",
      "Kappa Sigma",
      "Rosenstiel Marine",
    ],
    groups: [
      ["beach-club", "Key Biscayne crew."],
      ["game-day", "Hard Rock Stadium Saturdays."],
    ],
  },
] as const;

const FEMALE = [
  "Caroline",
  "Sallie",
  "Molly",
  "Harper",
  "Ellie",
  "Avery",
  "Sloane",
  "Margaret",
  "Lila",
  "Josie",
  "Reese",
  "Camille",
  "Quinn",
  "Nora",
  "Tessa",
  "Vivian",
  "Maren",
  "Georgia",
  "Ivy",
  "Paige",
  "Delaney",
  "Simone",
  "Priya",
  "Maya",
  "Leah",
  "Anaya",
  "Sofia",
  "Isabel",
  "Hana",
  "Gabriela",
];
const MALE = [
  "Walker",
  "Beau",
  "Tripp",
  "Peyton",
  "Wyatt",
  "Harrison",
  "Davis",
  "Graham",
  "Hudson",
  "Cole",
  "Mason",
  "Luca",
  "Theo",
  "Jonah",
  "Elliot",
  "Marcus",
  "Andre",
  "Ravi",
  "Diego",
  "Kai",
  "Owen",
  "Nate",
  "Silas",
  "Reid",
  "Mateo",
  "Jalen",
  "Sam",
  "Ethan",
  "Rohan",
  "Brooks",
];
const NB = ["River", "Rowan", "Sage", "Remy", "Ari", "Jules"];
const LAST = [
  "Vance",
  "Hayes",
  "Montgomery",
  "Butler",
  "Ross",
  "Cole",
  "Bennett",
  "Collins",
  "Forde",
  "Phillips",
  "Whitaker",
  "Ellison",
  "Calloway",
  "Dunn",
  "Prescott",
  "Okafor",
  "Reyes",
  "Nakamura",
  "Patel",
  "Lindqvist",
  "Moreau",
  "Delgado",
  "Achebe",
  "Kim",
  "Sullivan",
  "Navarro",
  "Hale",
  "Brennan",
  "Castillo",
  "Abernathy",
  "Whitfield",
  "Mercer",
  "Langley",
  "Ashford",
  "Holloway",
  "Rhodes",
];
const MAJORS = [
  "Marketing",
  "Economics",
  "Computer Science",
  "Nursing",
  "Public Policy",
  "Finance",
  "Biology",
  "Journalism",
  "Mechanical Engineering",
  "Film",
  "Psychology",
  "Architecture",
  "Political Science",
  "Music",
  "Marine Science",
  "Accounting",
  "Neuroscience",
];
const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad student"];
const HOBBIES = [
  "Saturday tailgates",
  "sunrise runs",
  "thrifting",
  "pickup basketball",
  "film photography",
  "late-night tacos",
  "intramural soccer",
  "open mics",
  "beach volleyball",
  "coffee-shop hopping",
  "pickleball",
  "road trips",
  "vinyl collecting",
  "cooking for friends",
];

const COMMENTS = [
  "Genuinely one of the nicest people on campus.",
  "Always the first one to say hi in class.",
  "Carried our group project, no notes.",
  "Best tailgate energy, every single weekend.",
  "Showed up for me during finals week — legend.",
  "Funniest person in our dorm by a mile.",
  "Hosts the best study sessions.",
  "Never misses a game. Ultimate fan.",
  "Kind to everyone, no matter what.",
  "Taught me how to actually cook pasta.",
  "Main character energy in the best way.",
  "That playlist at the cookout was elite.",
];
const ADVICE = [
  "Add a little more to your bio — people vote higher when they know your vibe.",
  "Jump into the group threads more; people rate who they know.",
  "A brighter, outdoor photo would make a great first impression.",
  "Show off your hobbies in your bio — it's a great conversation starter.",
  "Come out to more campus events, you'd climb fast.",
  "Your energy in person is way better than your pic — post a candid one!",
  "Tag your org in your affiliation so friends can find you.",
  "Keep being you — the votes will follow.",
];
const GROUP_CHATTER = [
  "Who's around this weekend?",
  "Anyone have notes from Tuesday's lecture?",
  "Lines were insane today 😅",
  "Count me in!",
  "Meet at the usual spot at 7?",
  "This thread is the best part of my day.",
  "Just saw the new rankings — congrats to everyone in the top 10!",
  "Reminder: be kind in the comments, y'all 🙏",
  "Who's driving? I can split gas.",
  "Coffee run in 20, anyone want anything?",
  "That game was unreal.",
  "Study group in the library tonight, all welcome.",
];

/* ── Main ──────────────────────────────────────────────────────────────── */
async function main() {
  const { db, close, driver } = createDb();
  try {
    if (args.has("--reset")) {
      await db.execute(sql`truncate table
        ${s.voteEvents}, ${s.ratings}, ${s.comments}, ${s.groupMessages}, ${s.groups}, ${s.reports},
        ${s.creditTransactions}, ${s.images}, ${s.bubbleMembers}, ${s.profiles}, ${s.sessions},
        ${s.bubbles}, ${s.users} cascade`);
      console.log("• Database wiped");
    } else {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(s.bubbles);
      if (n > 0) {
        if (args.has("--if-empty")) {
          console.log("✓ Database already has data — skipping seed");
          return;
        }
        throw new Error("Database is not empty. Use `npm run db:reset` to wipe and reseed.");
      }
    }
    await seed(db);
    console.log(`✓ Seeded demo data (${driver})`);
    console.log(`\n  Demo login:  demo@popcount.ai  /  ${DEMO_PASSWORD}`);
    console.log(`  Admin login: admin@popcount.ai /  ${ADMIN_PASSWORD}\n`);
  } finally {
    await close();
  }
}

async function seed(db: Db) {
  const demoHash = await hashPassword(DEMO_PASSWORD);
  const adminHash = await hashPassword(ADMIN_PASSWORD);
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000 - int(0, 86_000) * 1000);

  // Staff accounts
  const [admin] = await db
    .insert(s.users)
    .values({
      email: "admin@popcount.ai",
      handle: "admin",
      passwordHash: adminHash,
      role: "ADMIN",
      creditBalance: 1000,
      termsAcceptedAt: new Date(),
    })
    .returning();
  const [demo] = await db
    .insert(s.users)
    .values({
      email: "demo@popcount.ai",
      handle: "demo",
      passwordHash: demoHash,
      creditBalance: SIGNUP_GRANT_CENTS,
      termsAcceptedAt: new Date(),
    })
    .returning();

  const usedHandles = new Set(["admin", "demo"]);
  const uniqueHandle = (first: string, last: string) => {
    const base = `${first}_${last[0]}`.toLowerCase().replace(/[^a-z0-9_]/g, "");
    let h = base;
    for (let i = 2; usedHandles.has(h); i++) h = `${base}${i}`;
    usedHandles.add(h);
    return h;
  };

  type Seeded = { userId: string; profileId?: string; bubbleId: string; trueAura?: number };
  const people: Seeded[] = [];
  const profileRows: { id: string; userId: string; bubbleId: string; trueAura: number; gender: string }[] = [];
  const bubbleIds: Record<string, string> = {};

  for (const c of CAMPUSES) {
    const county = lookupCounty(c.lat, c.lng);
    if (!county) throw new Error(`No county for ${c.name}`);
    const [bubble] = await db
      .insert(s.bubbles)
      .values({
        slug: c.slug,
        name: c.name,
        description: c.description,
        kind: "CAMPUS",
        badge: c.badge,
        lat: c.lat,
        lng: c.lng,
        countyFips: county.fips,
        countyName: county.county,
        stateName: county.state,
        population: c.population,
        isOfficial: true,
        createdById: admin.id,
        createdAt: daysAgo(30),
      })
      .returning();
    bubbleIds[c.slug] = bubble.id;

    // Profile owners — each demo person opted in by creating their own profile.
    for (let i = 0; i < c.profiles; i++) {
      const g = i % 7 === 6 ? "NON_BINARY" : i % 2 === 0 ? "FEMALE" : "MALE";
      const first = g === "FEMALE" ? pick(FEMALE) : g === "MALE" ? pick(MALE) : pick(NB);
      let last = pick(LAST);
      while (last === first) last = pick(LAST);
      const handle = uniqueHandle(first, last);
      const [u] = await db
        .insert(s.users)
        .values({
          email: `${handle}@demo.popcount.ai`,
          handle,
          passwordHash: demoHash,
          creditBalance: int(40, SIGNUP_GRANT_CENTS),
          termsAcceptedAt: daysAgo(int(5, 25)),
          createdAt: daysAgo(int(5, 25)),
        })
        .returning();
      const trueAura = clamp(58 + gauss() * 20, 12, 97);
      const [p] = await db
        .insert(s.profiles)
        .values({
          userId: u.id,
          bubbleId: bubble.id,
          displayName: `${first} ${last}`,
          gender: g,
          affiliation: pick(c.orgs),
          bio: `${pick(YEARS)} • ${pick(MAJORS)}. Into ${pick(HOBBIES)} and ${pick(HOBBIES)}.`,
          photoUrl: `/api/avatar/${handle}`,
          createdAt: daysAgo(int(3, 20)),
        })
        .returning();
      people.push({ userId: u.id, profileId: p.id, bubbleId: bubble.id, trueAura });
      profileRows.push({ id: p.id, userId: u.id, bubbleId: bubble.id, trueAura, gender: g });
    }

    // Lurkers — members who rate and chat without a public profile.
    const lurkers = Array.from({ length: c.lurkers }, () => {
      const first = pick([...FEMALE, ...MALE, ...NB]);
      const last = pick(LAST);
      const handle = uniqueHandle(first, last);
      return {
        email: `${handle}@demo.popcount.ai`,
        handle,
        passwordHash: demoHash,
        creditBalance: int(0, SIGNUP_GRANT_CENTS),
        termsAcceptedAt: daysAgo(int(1, 25)),
        createdAt: daysAgo(int(1, 25)),
      };
    });
    const inserted = await db.insert(s.users).values(lurkers).returning({ id: s.users.id });
    for (const l of inserted) people.push({ userId: l.id, bubbleId: bubble.id });
  }

  // Memberships (+ the demo account joins Duke so it can chat right away).
  await db
    .insert(s.bubbleMembers)
    .values([
      ...people.map((p) => ({ bubbleId: p.bubbleId, userId: p.userId, joinedAt: daysAgo(int(1, 25)) })),
      { bubbleId: bubbleIds["duke"], userId: demo.id },
      ...Object.values(bubbleIds).map((bubbleId) => ({ bubbleId, userId: admin.id })),
    ]);

  // Ratings: dense inside a rater's home bubble, sparse nationally.
  const ratingRows: (typeof s.ratings.$inferInsert)[] = [];
  const eventRows: (typeof s.voteEvents.$inferInsert)[] = [];
  const creditRows: (typeof s.creditTransactions.$inferInsert)[] = [];
  for (const rater of people) {
    for (const prof of profileRows) {
      if (prof.userId === rater.userId) continue;
      const home = prof.bubbleId === rater.bubbleId;
      if (!chance(home ? 0.62 : 0.07)) continue;
      const quick = chance(0.25);
      const raw = clamp(Math.round(prof.trueAura + gauss() * 17), 0, 100);
      const value = quick ? (raw >= 50 ? 100 : 0) : raw;
      const boosts = chance(0.12) ? int(1, 6) : 0;
      const at = daysAgo(rand() < 0.45 ? rand() * 6.5 : 7 + rand() * 12);
      ratingRows.push({
        profileId: prof.id,
        raterId: rater.userId,
        value,
        weight: 1 + boosts,
        createdAt: at,
        updatedAt: at,
      });
      eventRows.push({
        profileId: prof.id,
        bubbleId: prof.bubbleId,
        raterId: rater.userId,
        kind: "RATE",
        value,
        weight: 1,
        createdAt: at,
      });
      if (boosts) {
        eventRows.push({
          profileId: prof.id,
          bubbleId: prof.bubbleId,
          raterId: rater.userId,
          kind: "BOOST",
          value,
          weight: boosts,
          createdAt: at,
        });
        creditRows.push({ userId: rater.userId, amount: -boosts, reason: "BOOST", reference: prof.id, createdAt: at });
      }
    }
  }
  for (const rows of chunks(ratingRows, 500)) await db.insert(s.ratings).values(rows);
  for (const rows of chunks(eventRows, 500)) await db.insert(s.voteEvents).values(rows);
  for (const rows of chunks(creditRows, 500)) await db.insert(s.creditTransactions).values(rows);
  await db
    .insert(s.creditTransactions)
    .values([admin, demo].map((u) => ({ userId: u.id, amount: u.creditBalance, reason: "SIGNUP_GRANT" as const })));

  // Comments & advice threads.
  const commentRows: (typeof s.comments.$inferInsert)[] = [];
  for (const prof of profileRows) {
    const authors = people.filter((p) => p.bubbleId === prof.bubbleId && p.userId !== prof.userId);
    for (let i = int(0, 4); i > 0; i--) {
      commentRows.push({
        profileId: prof.id,
        authorId: pick(authors).userId,
        kind: "COMMENT",
        body: pick(COMMENTS),
        createdAt: daysAgo(rand() * 10),
      });
    }
    for (let i = int(0, 2); i > 0; i--) {
      commentRows.push({
        profileId: prof.id,
        authorId: pick(authors).userId,
        kind: "ADVICE",
        body: pick(ADVICE),
        createdAt: daysAgo(rand() * 10),
      });
    }
  }
  const insertedComments = await db
    .insert(s.comments)
    .values(commentRows)
    .returning({ id: s.comments.id, authorId: s.comments.authorId });

  // Group channels with some chatter.
  for (const c of CAMPUSES) {
    const bubbleId = bubbleIds[c.slug];
    const members = people.filter((p) => p.bubbleId === bubbleId);
    const defs: [string, string][] = [
      ["general", `Everything ${c.name}.`],
      ...c.groups.map((g) => [g[0], g[1]] as [string, string]),
    ];
    for (const [slug, description] of defs) {
      const msgs = Array.from({ length: int(4, 9) }, () => ({
        authorId: pick(members).userId,
        body: pick(GROUP_CHATTER),
        createdAt: daysAgo(rand() * 5),
      })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const [g] = await db
        .insert(s.groups)
        .values({
          bubbleId,
          slug,
          name: slug,
          description,
          createdById: admin.id,
          messageCount: msgs.length,
          lastMessageAt: msgs[msgs.length - 1].createdAt,
        })
        .returning();
      await db.insert(s.groupMessages).values(msgs.map((m) => ({ ...m, groupId: g.id })));
    }
  }

  // One open report so the admin moderation queue has something to show.
  const target = insertedComments[0];
  const reporter = people.find((p) => p.userId !== target.authorId)!;
  await db.insert(s.reports).values({
    reporterId: reporter.userId,
    targetType: "COMMENT",
    targetId: target.id,
    reason: "spam",
    details: "Seeded example report.",
  });
  await db
    .update(s.comments)
    .set({ reportCount: 1 })
    .where(sql`${s.comments.id} = ${target.id}`);

  // Denormalised aggregates.
  await db.execute(sql`
    update ${s.profiles} p set
      rating_sum = a.sum, vote_count = a.votes, up_count = a.up, down_count = a.down, rater_count = a.raters,
      aura_score = round(a.sum::numeric / nullif(a.votes, 0), 1)::real
    from (
      select profile_id, sum(value * weight)::int sum, sum(weight)::int votes,
        coalesce(sum(weight) filter (where value >= 50), 0)::int up,
        coalesce(sum(weight) filter (where value < 50), 0)::int down, count(*)::int raters
      from ${s.ratings} group by profile_id
    ) a where a.profile_id = p.id`);
  await db.execute(sql`
    update ${s.profiles} p set
      comment_count = coalesce((select count(*) from ${s.comments} c where c.profile_id = p.id and c.kind = 'COMMENT' and not c.is_hidden), 0),
      advice_count = coalesce((select count(*) from ${s.comments} c where c.profile_id = p.id and c.kind = 'ADVICE' and not c.is_hidden), 0)`);
  await db.execute(sql`
    update ${s.bubbles} b set member_count = (select count(*) from ${s.bubbleMembers} m where m.bubble_id = b.id)`);

  console.log(
    `  ${CAMPUSES.length} bubbles · ${profileRows.length} profiles · ${people.length + 2} accounts · ${ratingRows.length} ratings · ${commentRows.length} comments`,
  );
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

main().catch((err) => {
  console.error("✗ Seed failed:", err);
  process.exit(1);
});
