import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

/** Driver-independent database type, so tests can use an in-process Postgres. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const g = globalThis as unknown as { __aimosaicDb?: Db };

/** Returns the database, or null when DATABASE_URL is not set (demo mode). */
export function getDb(): Db | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!g.__aimosaicDb) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    const client = postgres(url, {
      max: 5,
      ssl: local ? false : "require",
      prepare: false, // required for pooled connections (Neon, Supabase)
    });
    g.__aimosaicDb = drizzle(client, { schema }) as unknown as Db;
  }
  return g.__aimosaicDb;
}
