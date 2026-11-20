import { appUrl } from "@/lib/app-url";
import { sameOrigin } from "@/lib/ratelimit";
import { getContext, unauthorised } from "@/lib/server";
import { createSubscriptionCheckout, createTopupCheckout, stripeConfigured } from "@/lib/stripe";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ message: "Request not allowed." }, { status: 403 });
  const ctx = await getContext();
  if (!ctx) return unauthorised();
  if (!ctx.db || !stripeConfigured()) {
    return Response.json({ message: "Payments are not set up yet." }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = { id: ctx.userId, email: ctx.email, stripeCustomerId: ctx.stripeCustomerId };
  try {
    if (body.topup === true) return Response.json({ url: await createTopupCheckout(user, appUrl(req)) });
    const planId = body.planId === "plus" || body.planId === "pro" ? body.planId : null;
    const interval = body.interval === "year" ? "year" : "month";
    if (!planId) return Response.json({ message: "Choose the Plus or Pro plan." }, { status: 400 });
    if (ctx.plan.id !== "free" && ctx.stripeCustomerId) {
      return Response.json({ message: "You already have a plan. Use Manage billing to change it." }, { status: 409 });
    }
    return Response.json({ url: await createSubscriptionCheckout(user, planId, interval, appUrl(req)) });
  } catch (err) {
    console.error("checkout failed", err);
    return Response.json({ message: "Could not start checkout. Please try again." }, { status: 502 });
  }
}
