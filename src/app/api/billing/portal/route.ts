import { appUrl } from "@/lib/app-url";
import { sameOrigin } from "@/lib/ratelimit";
import { getContext, unauthorised } from "@/lib/server";
import { createPortal, stripeConfigured } from "@/lib/stripe";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ message: "Request not allowed." }, { status: 403 });
  const ctx = await getContext();
  if (!ctx) return unauthorised();
  if (!stripeConfigured() || !ctx.stripeCustomerId) {
    return Response.json({ message: "There is no billing account to manage yet." }, { status: 409 });
  }
  try {
    return Response.json({ url: await createPortal(ctx.stripeCustomerId, appUrl(req)) });
  } catch (err) {
    console.error("portal failed", err);
    return Response.json({ message: "Could not open billing. Please try again." }, { status: 502 });
  }
}
