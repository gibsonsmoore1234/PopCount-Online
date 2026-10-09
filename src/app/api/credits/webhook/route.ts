import { NextResponse } from "next/server";
import { api } from "@/lib/api/route";
import { fulfillSession, verifyStripeSignature } from "@/server/credits";

/** Stripe → us. Authenticated by the webhook signature, so the browser CSRF check is skipped. */
export const POST = api(
  async (req) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
    const payload = await req.text();
    if (!verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }
    const event = JSON.parse(payload) as { type: string; data: { object: Parameters<typeof fulfillSession>[0] } };
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const result = await fulfillSession(event.data.object);
      return { received: true, ...result };
    }
    return { received: true };
  },
  { csrf: false },
);
