import { connection } from "next/server";
import { isDemoMode } from "@/lib/gateway";
import { getContext, unauthorised } from "@/lib/server";

export async function GET() {
  await connection(); // per request, never prerendered
  const ctx = await getContext();
  if (!ctx) return unauthorised();
  return Response.json({
    available: await ctx.wallet.available(ctx.userId),
    monthlyTokens: ctx.plan.monthlyTokens,
    plan: ctx.plan.name,
    premiumModels: ctx.plan.premiumModels,
    email: ctx.email,
    isAdmin: ctx.isAdmin,
    demoMode: isDemoMode(),
    persistence: ctx.db !== null,
  });
}
