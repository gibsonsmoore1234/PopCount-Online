import { and, eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/lib/db";
import { creditTransactions, users } from "@/lib/db/schema";
import { ACTION_COST_CLICKS } from "@/lib/aura";
import { paymentRequired } from "@/lib/errors";

/** Boost clicks are earned only by watching ads (see ./ads.ts) — there are no paid purchases. */
export async function getBalance(userId: string) {
  const [u] = await db.select({ b: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.b ?? 0;
}

/**
 * Spend one click for an action that adds something (rating, comment, profile, bubble).
 * Runs inside the caller's transaction; throws 402 so the client can open "Get more clicks".
 */
export async function spendClick(tx: Tx, userId: string, reference: string) {
  const debited = await tx
    .update(users)
    .set({ creditBalance: sql`${users.creditBalance} - ${ACTION_COST_CLICKS}` })
    .where(and(eq(users.id, userId), sql`${users.creditBalance} >= ${ACTION_COST_CLICKS}`))
    .returning({ balance: users.creditBalance });
  if (debited.length === 0) throw paymentRequired("You're out of clicks — watch a quick ad to get 10 more.");
  await tx.insert(creditTransactions).values({ userId, amount: -ACTION_COST_CLICKS, reason: "ACTION", reference });
  return debited[0].balance;
}
