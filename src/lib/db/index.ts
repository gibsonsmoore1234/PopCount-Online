import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import path from "node:path";
import * as schema from "./schema";

/**
 * Database client.
 *
 * - With `DATABASE_URL` set → a pooled connection to PostgreSQL (production / docker-compose).
 * - Without it → an embedded PGlite instance (real Postgres compiled to WASM) persisted under
 *   `.data/pglite`, so `npm run dev` works with zero setup.
 *
 * Both drivers expose the same Drizzle Postgres query API, so the rest of the app is driver-agnostic.
 */
export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

type DbHandle = { db: Db; close: () => Promise<void>; driver: "postgres" | "pglite" };

export function createDb(options: { url?: string; pgliteDir?: string } = {}): DbHandle {
  const url = options.url ?? process.env.DATABASE_URL;
  if (url) {
    // Hosted Postgres (Supabase, Neon) needs TLS. An `sslmode` in the URL would override the `ssl` option
    // below and reject the provider's certificate chain, so strip it and configure TLS here instead.
    const parsed = new URL(url);
    const urlWantsSsl = ["require", "verify-ca", "verify-full", "prefer"].includes(
      parsed.searchParams.get("sslmode") ?? "",
    );
    parsed.searchParams.delete("sslmode");
    const useSsl =
      process.env.DATABASE_SSL === "true" || urlWantsSsl || /supabase\.(co|com)|neon\.tech/.test(parsed.hostname);
    const pool = new Pool({
      connectionString: parsed.toString(),
      max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 3 : 10)),
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    });
    return { db: drizzleNodePg(pool, { schema }), close: () => pool.end(), driver: "postgres" };
  }
  // An embedded on-disk database is for local development only; serverless/multi-instance hosts would lose data.
  if (
    process.env.NODE_ENV === "production" &&
    !options.pgliteDir &&
    process.env.ALLOW_PGLITE_IN_PRODUCTION !== "true"
  ) {
    throw new Error("DATABASE_URL is required in production (set ALLOW_PGLITE_IN_PRODUCTION=true to override).");
  }
  const dir = options.pgliteDir ?? process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const client = dir === "memory" ? new PGlite() : new PGlite(dir);
  const db = drizzlePglite(client, { schema }) as unknown as Db;
  return { db, close: () => client.close(), driver: "pglite" };
}

const globalForDb = globalThis as unknown as { __pcDb?: DbHandle };

function handle(): DbHandle {
  // Re-use one client across hot reloads in development (PGlite must only be opened once per process).
  globalForDb.__pcDb ??= createDb();
  return globalForDb.__pcDb;
}

/** Lazily-initialised shared database instance. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = handle().db as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
});

/** Swap the shared instance (used by integration tests). */
export function setDb(next: DbHandle) {
  globalForDb.__pcDb = next;
}

export function dbDriver() {
  return handle().driver;
}

export { schema };
