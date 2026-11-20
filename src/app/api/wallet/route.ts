import { connection } from "next/server";
import { isDemoMode } from "@/lib/gateway";
import { DEMO_PLAN, getContext } from "@/lib/server";

export async function GET() {
  await connection(); // wallet state is per request, never prerendered
  const ctx = await getContext();
  return Response.json({
    available: await ctx.wallet.available(ctx.userId),
    monthlyTokens: DEMO_PLAN.monthlyTokens,
    plan: DEMO_PLAN.name,
    demoMode: isDemoMode(),
    persistence: ctx.db !== null,
  });
}
