import { firstSeen, forgetEvent } from "@/lib/billing";
import { getBase } from "@/lib/server";
import { handleStripeEvent, verifySignature } from "@/lib/stripe";

/**
 * Stripe calls this address. It is not protected by sign-in; instead every
 * request must carry a valid signature made with STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const { db } = await getBase();
  if (!secret || !db) return Response.json({ error: "Billing is not configured" }, { status: 503 });

  const payload = await req.text(); // the raw body: the signature covers these exact bytes
  if (!verifySignature(payload, req.headers.get("stripe-signature"), secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  let event: { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!event.id || !event.type || !event.data?.object) return Response.json({ error: "Malformed event" }, { status: 400 });

  // Stripe may deliver the same event more than once; apply each id once.
  if (!(await firstSeen(db, event.id, event.type))) return Response.json({ received: true, duplicate: true });
  try {
    const result = await handleStripeEvent(db, { type: event.type, data: { object: event.data.object } });
    console.log(`stripe ${event.type}: ${result}`);
    return Response.json({ received: true });
  } catch (err) {
    console.error("webhook handling failed", event.type, err);
    // A 500 makes Stripe retry later; forget the id so the retry is processed.
    await forgetEvent(db, event.id);
    return Response.json({ error: "Handler failed" }, { status: 500 });
  }
}
