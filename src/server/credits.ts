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
