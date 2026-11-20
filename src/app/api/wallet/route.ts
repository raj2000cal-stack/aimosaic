import { connection } from "next/server";
import { PLANS } from "@/lib/catalog";
import { isDemoMode } from "@/lib/gateway";
import { DEMO_USER_ID, wallet } from "@/lib/server";

export async function GET() {
  await connection(); // wallet state is per request, never prerendered
  const plan = PLANS.find((p) => p.id === "plus")!;
  return Response.json({
    available: await wallet.available(DEMO_USER_ID),
    monthlyTokens: plan.monthlyTokens,
    plan: plan.name,
    demoMode: isDemoMode(),
  });
}
