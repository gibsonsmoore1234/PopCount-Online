import path from "node:path";
import fs from "node:fs";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { createDb } from "../src/lib/db";

loadEnvFile();

async function main() {
  // `npm run build` migrates only when a real database is configured (e.g. on Vercel).
  if (process.argv.includes("--if-configured") && !process.env.DATABASE_URL) return;
  const { db, close, driver } = createDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (driver === "pglite") {
    fs.mkdirSync(path.join(process.cwd(), ".data"), { recursive: true });
    await migratePglite(db as unknown as PgliteDatabase, { migrationsFolder });
  } else {
    await migratePg(db, { migrationsFolder });
  }
  await close();
  console.log(`✓ Database migrated (${driver})`);
}

export function loadEnvFile() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), file);
    if (fs.existsSync(p)) process.loadEnvFile(p);
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  main().catch((err) => {
    console.error("✗ Migration failed:", err);
    process.exit(1);
  });
}
