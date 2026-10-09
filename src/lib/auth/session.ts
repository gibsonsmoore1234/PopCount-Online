import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import { forbidden, unauthorized } from "@/lib/errors";

export const SESSION_COOKIE = "pc_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RENEW_WITHIN_MS = 15 * 24 * 60 * 60 * 1000;

export type SessionUser = Pick<
  User,
  "id" | "email" | "handle" | "role" | "creditBalance" | "termsAcceptedAt" | "isAnonymous"
>;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 255) ?? null;
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, userAgent });
  await setSessionCookie(token, expiresAt);
  // Opportunistic cleanup of expired sessions for this user.
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lt(sessions.expiresAt, new Date())));
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Resolve the signed-in user from the session cookie (memoised per request in server components). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const id = hashToken(token);
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      handle: users.handle,
      role: users.role,
      isAnonymous: users.isAnonymous,
      creditBalance: users.creditBalance,
      termsAcceptedAt: users.termsAcceptedAt,
      bannedAt: users.bannedAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.bannedAt) return null;

  // Sliding expiry: extend sessions that are past the half-way point.
  if (row.expiresAt.getTime() - Date.now() < RENEW_WITHIN_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    try {
      await setSessionCookie(token, expiresAt);
    } catch {
      // Cookies are read-only while rendering server components; the next API call refreshes it.
    }
  }

  return {
    id: row.id,
    email: row.email,
    handle: row.handle,
    role: row.role,
    isAnonymous: row.isAnonymous,
    creditBalance: row.creditBalance,
    termsAcceptedAt: row.termsAcceptedAt,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden("Admins only.");
  return user;
}

/**
 * Writing actions (rate, comment, boost, chat, report) never require signing up: a visitor without a
 * session is given an anonymous device identity (random handle, httpOnly session cookie) on first use.
 */
export async function requireMember(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) {
    if (!user.termsAcceptedAt) throw forbidden("Accept the community terms before posting or voting.");
    return user;
  }
  return createAnonymousUser();
}

async function createAnonymousUser(): Promise<SessionUser> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const handle = `anon_${randomBytes(3).toString("hex")}`;
    const [u] = await db
      .insert(users)
      .values({
        email: `${handle}-${randomBytes(6).toString("hex")}@anon.popcount.ai`,
        handle,
        passwordHash: "!anonymous",
        isAnonymous: true,
        creditBalance: 0,
        termsAcceptedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();
    if (!u) continue;
    await createSession(u.id);
    return {
      id: u.id,
      email: u.email,
      handle: u.handle,
      role: u.role,
      isAnonymous: true,
      creditBalance: u.creditBalance,
      termsAcceptedAt: u.termsAcceptedAt,
    };
  }
  throw unauthorized("Couldn't start an anonymous session — try again.");
}

/** Posting a profile is the one action that needs a real (non-anonymous) account: you can only post yourself. */
export async function requireAccount(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.isAnonymous) throw forbidden("Make a quick account to post your own profile.");
  if (!user.termsAcceptedAt) throw forbidden("Accept the community terms first.");
  return user;
}
