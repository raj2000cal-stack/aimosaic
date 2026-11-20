/**
 * Fixed-window rate limiting backed by Postgres, so the limit holds across
 * every server instance. One atomic statement per check.
 */
import { sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { rateLimits } from "@/db/schema";

export const LIMITS = {
  chat: { max: 30, windowSeconds: 60 }, // model calls per user per minute
  login: { max: 10, windowSeconds: 15 * 60 }, // attempts per IP and email
  signup: { max: 5, windowSeconds: 60 * 60 }, // accounts per IP per hour
} as const;

/** Returns true if the action is allowed, and counts it. */
export async function allow(
  db: Db,
  key: string,
  limit: { max: number; windowSeconds: number },
): Promise<boolean> {
  // Window arithmetic is done by the database clock, so every instance agrees.
  const expired = sql`${rateLimits.windowStart} < now() - make_interval(secs => ${limit.windowSeconds})`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: sql`now()`, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        windowStart: sql`case when ${expired} then now() else ${rateLimits.windowStart} end`,
      },
    })
    .returning({ count: rateLimits.count });
  return row.count <= limit.max;
}

/** Best-effort client address from proxy headers. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Rejects cross-site form posts: when the browser sends an Origin header it
 * must match the host being called.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients send no Origin and carry no cookies by default
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}
