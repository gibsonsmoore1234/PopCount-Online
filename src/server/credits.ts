import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function getBalance(userId: string) {
  const [u] = await db.select({ b: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.b ?? 0;
}
