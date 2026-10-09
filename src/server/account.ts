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

export async function login(input: LoginInput) {
  const id = input.identifier.trim().toLowerCase().replace(/^@/, "");
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
  const [[profile], memberships] = await Promise.all([
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        photoUrl: profiles.photoUrl,
        bubbleSlug: bubbles.slug,
        bubbleName: bubbles.name,
      })
      .from(profiles)
      .innerJoin(bubbles, eq(bubbles.id, profiles.bubbleId))
      .where(eq(profiles.userId, user.id))
      .limit(1),
    db.select({ bubbleId: bubbleMembers.bubbleId }).from(bubbleMembers).where(eq(bubbleMembers.userId, user.id)),
  ]);
  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    role: user.role,
    creditBalance: user.creditBalance,
    termsAccepted: Boolean(user.termsAcceptedAt),
    profile: profile ?? null,
    memberships: memberships.map((m) => m.bubbleId),
  };
}

export async function acceptTerms(user: SessionUser) {
  await db.update(users).set({ termsAcceptedAt: new Date() }).where(eq(users.id, user.id));
  return { accepted: true };
}
