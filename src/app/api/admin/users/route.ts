import { adjustUser } from "@/lib/admin";
import { PLANS } from "@/lib/catalog";
import { sameOrigin } from "@/lib/ratelimit";
import { getContext } from "@/lib/server";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ message: "Request not allowed." }, { status: 403 });
  const ctx = await getContext();
  if (!ctx || !ctx.isAdmin || !ctx.db) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const planId = typeof body.planId === "string" && body.planId ? body.planId : undefined;
  const creditTokens = Number.isInteger(body.creditTokens) ? (body.creditTokens as number) : 0;

  if (!email || !reason) return Response.json({ message: "Email and reason are required." }, { status: 400 });
  if (planId && !PLANS.some((p) => p.id === planId)) return Response.json({ message: "Unknown plan." }, { status: 400 });
  if (Math.abs(creditTokens) > 100_000_000) return Response.json({ message: "That credit is too large." }, { status: 400 });
  if (!planId && !creditTokens) return Response.json({ message: "Choose a plan or a token credit." }, { status: 400 });

  const ok = await adjustUser(ctx.db, { email, planId, creditTokens, reason, adminEmail: ctx.email ?? "unknown" });
  return ok ? Response.json({ ok: true }) : Response.json({ message: "No user with that email." }, { status: 404 });
}
