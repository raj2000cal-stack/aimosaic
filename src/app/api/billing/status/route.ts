import { connection } from "next/server";
import { TOPUP_TOKENS } from "@/lib/billing";
import { getContext, unauthorised } from "@/lib/server";
import { priceFor, stripeConfigured, topupPrice } from "@/lib/stripe";

export async function GET() {
  await connection();
  const ctx = await getContext();
  if (!ctx) return unauthorised();
  const configured = stripeConfigured() && ctx.db !== null;
  return Response.json({
    configured,
    planId: ctx.plan.id,
    canManage: configured && ctx.stripeCustomerId !== null,
    topupTokens: configured && topupPrice() ? TOPUP_TOKENS : 0,
    available: {
      "plus:month": configured && Boolean(priceFor("plus", "month")),
      "plus:year": configured && Boolean(priceFor("plus", "year")),
      "pro:month": configured && Boolean(priceFor("pro", "month")),
      "pro:year": configured && Boolean(priceFor("pro", "year")),
    },
  });
}
