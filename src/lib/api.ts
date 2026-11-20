/** Shared checks for the helper API routes: origin, sign-in, rate limit. */
import { LIMITS, allow, sameOrigin } from "./ratelimit";
import { getContext, unauthorised, type Ctx } from "./server";

export async function guard(req: Request): Promise<{ ctx: Ctx } | { response: Response }> {
  if (!sameOrigin(req)) return { response: Response.json({ message: "Request not allowed." }, { status: 403 }) };
  const ctx = await getContext();
  if (!ctx) return { response: unauthorised() };
  if (ctx.db && !(await allow(ctx.db, `chat:${ctx.userId}`, LIMITS.chat))) {
    return {
      response: Response.json(
        { error: "rate_limited", message: "You are sending requests too quickly. Wait a minute and try again." },
        { status: 429 },
      ),
    };
  }
  return { ctx };
}

export const insufficient = () =>
  Response.json({ error: "insufficient_balance", message: "Not enough tokens for this." }, { status: 402 });

export const modelFailed = () =>
  Response.json({ error: "model_failed", message: "The model could not be reached. You were not charged." }, { status: 502 });
