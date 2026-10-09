import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Deploy check: confirms the database is reachable and migrated. Never echoes the connection string. */
export async function GET() {
  if (!process.env.DATABASE_URL)
    return NextResponse.json({ ok: false, error: "DATABASE_URL is not set" }, { status: 500 });
  try {
    await db.execute(sql`select 1 from bubbles limit 1`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { message?: string; code?: string };
    const message = (e.message ?? String(err)).replace(/postgres(ql)?:\/\/[^\s]+/g, "[url]");
    return NextResponse.json({ ok: false, code: e.code ?? null, error: message }, { status: 500 });
  }
}
