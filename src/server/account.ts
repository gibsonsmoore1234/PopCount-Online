import { randomBytes, timingSafeEqual } from "node:crypto";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bubbleMembers, bubbles, creditTransactions, profiles, users } from "@/lib/db/schema";
import { conflict, forbidden, isUniqueViolation, unauthorized } from "@/lib/errors";
import { SIGNUP_GRANT_CENTS } from "@/lib/aura";
import { containsBlockedLanguage } from "@/lib/moderation";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, type SessionUser } from "@/lib/auth/session";
import type { LoginInput, SignupInput } from "@/lib/validation";
import type { Me } from "@/types/api";

export async function signup(input: SignupInput) {
  if (containsBlockedLanguage(input.handle)) throw conflict("Pick a different handle.");
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({
          email: input.email,
          handle: input.handle,
          passwordHash,
          creditBalance: SIGNUP_GRANT_CENTS,
          termsAcceptedAt: new Date(),
        })
        .returning({ id: users.id });
      await tx.insert(creditTransactions).values({ userId: u.id, amount: SIGNUP_GRANT_CENTS, reason: "SIGNUP_GRANT" });
      return u;
    });
    await createSession(user.id);
    return { id: user.id };
  } catch (err) {
    if (isUniqueViolation(err, "users_email_key")) throw conflict("An account with that email already exists.");
    if (isUniqueViolation(err, "users_handle_key")) throw conflict("That handle is taken.");
    throw err;
  }
}

/**
 * With no sign-up, the admin account comes from ADMIN_EMAIL / ADMIN_PASSWORD. The first login with those
 * credentials creates (or promotes) the account; afterwards the stored password hash is used as normal.
 */
async function bootstrapAdmin(id: string, password: string) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const secret = process.env.ADMIN_PASSWORD;
  if (!email || !secret || secret.length < 8 || id !== email) return;
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return;
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db.update(users).set({ role: "ADMIN" }).where(eq(users.id, existing.id));
    return;
  }
  await db.insert(users).values({
    email,
    handle: `admin_${randomBytes(3).toString("hex")}`,
    passwordHash: await hashPassword(secret),
    role: "ADMIN",
    termsAcceptedAt: new Date(),
  });
}

export async function login(input: LoginInput) {
  const id = input.identifier.trim().toLowerCase().replace(/^@/, "");
  await bootstrapAdmin(id, input.password);
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, bannedAt: users.bannedAt })
    .from(users)
    .where(or(sql`lower(${users.email}) = ${id}`, sql`lower(${users.handle}) = ${id}`))
    .limit(1);
  // Always run one hash comparison so response time doesn't reveal whether the account exists.
  const ok = await verifyPassword(input.password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !ok) throw unauthorized("Incorrect email/handle or password.");
  if (user.bannedAt) throw forbidden("This account has been suspended for violating the community guidelines.");
  await createSession(user.id);
  return { id: user.id };
}

export async function getMe(user: SessionUser): Promise<Me> {
  const [mine, memberships] = await Promise.all([
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        photoUrl: profiles.photoUrl,
        bubbleId: profiles.bubbleId,
        bubbleSlug: bubbles.slug,
        bubbleName: bubbles.name,
      })
      .from(profiles)
      .innerJoin(bubbles, eq(bubbles.id, profiles.bubbleId))
      .where(eq(profiles.userId, user.id)),
    db.select({ bubbleId: bubbleMembers.bubbleId }).from(bubbleMembers).where(eq(bubbleMembers.userId, user.id)),
  ]);
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    role: user.role,
    isAnonymous: user.isAnonymous,
    creditBalance: user.creditBalance,
    termsAccepted: Boolean(user.termsAcceptedAt),
    profile: mine[0]
      ? {
          id: mine[0].id,
          displayName: mine[0].displayName,
          photoUrl: mine[0].photoUrl,
          bubbleSlug: mine[0].bubbleSlug,
          bubbleName: mine[0].bubbleName,
        }
      : null,
    profileBubbleIds: mine.map((p) => p.bubbleId),
    memberships: memberships.map((m) => m.bubbleId),
  };
}

export async function acceptTerms(user: SessionUser) {
  await db.update(users).set({ termsAcceptedAt: new Date() }).where(eq(users.id, user.id));
  return { accepted: true };
}
