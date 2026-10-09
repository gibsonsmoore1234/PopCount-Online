import { sql } from "drizzle-orm";
import { api } from "@/lib/api/route";
import { db, dbDriver } from "@/lib/db";

export const GET = api(async () => {
  await db.execute(sql`select 1`);
  return { ok: true, db: dbDriver() };
});
