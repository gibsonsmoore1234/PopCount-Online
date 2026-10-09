import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditTransactions, users } from "@/lib/db/schema";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/aura";
import { ApiError, badRequest, isUniqueViolation } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth/session";
import type { CheckoutResult } from "@/types/api";

/**
 * Boost-credit purchases.
 *
 * PAYMENTS_MODE:
 *   - "stripe"   → Stripe Checkout (requires STRIPE_SECRET_KEY; credits granted by the signed webhook
 *                   or on return from Checkout — both paths are idempotent on the session id).
 *   - "demo"     → credits are granted instantly with no charge (local development / demos).
 *   - "disabled" → purchases are turned off.
 * Default: "stripe" when STRIPE_SECRET_KEY is set, otherwise "demo".
 */
export function paymentsMode(): "stripe" | "demo" | "disabled" {
  const explicit = process.env.PAYMENTS_MODE;
  if (explicit === "stripe" || explicit === "demo" || explicit === "disabled") return explicit;
  return process.env.STRIPE_SECRET_KEY ? "stripe" : "demo";
}

export function getPack(id: string) {
  const pack = CREDIT_PACKS.find((p) => p.id === id);
  if (!pack) throw badRequest("Unknown credit pack.");
  return pack;
}

/** Grant credits exactly once per external reference. Returns false if already granted. */
export async function grantPurchase(userId: string, clicks: number, reference: string) {
  try {
    await db.transaction(async (tx) => {
      await tx.insert(creditTransactions).values({ userId, amount: clicks, reason: "PURCHASE", reference });
      await tx
        .update(users)
        .set({ creditBalance: sql`${users.creditBalance} + ${clicks}` })
        .where(eq(users.id, userId));
    });
    return true;
  } catch (err) {
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

export async function getBalance(userId: string) {
  const [u] = await db.select({ b: users.creditBalance }).from(users).where(eq(users.id, userId)).limit(1);
  return u?.b ?? 0;
}

export async function startCheckout(user: SessionUser, packId: CreditPackId, origin: string): Promise<CheckoutResult> {
  const pack = getPack(packId);
  const mode = paymentsMode();
  if (mode === "disabled")
    throw new ApiError(503, "Credit purchases are temporarily unavailable.", "payments_disabled");

  if (mode === "demo") {
    await grantPurchase(user.id, pack.clicks, `demo_${crypto.randomUUID()}`);
    return { mode, creditBalance: await getBalance(user.id) };
  }

  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(pack.priceCents),
    "line_items[0][price_data][product_data][name]": `Popularity Contest · ${pack.label} boost pack`,
    "line_items[0][price_data][product_data][description]": pack.blurb,
    client_reference_id: user.id,
    customer_email: user.email,
    "metadata[userId]": user.id,
    "metadata[packId]": pack.id,
    "metadata[clicks]": String(pack.clicks),
    success_url: `${origin}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancelled`,
  });
  const session = await stripe<{ id: string; url: string }>("POST", "/v1/checkout/sessions", params);
  return { mode, url: session.url };
}

type StripeSession = {
  id: string;
  payment_status: "paid" | "unpaid" | "no_payment_required";
  metadata: { userId?: string; packId?: string; clicks?: string } | null;
};

/** Grant the credits for a completed Checkout session (safe to call repeatedly). */
export async function fulfillSession(session: StripeSession) {
  if (session.payment_status !== "paid") return { granted: false, reason: "unpaid" as const };
  const userId = session.metadata?.userId;
  const pack = session.metadata?.packId ? CREDIT_PACKS.find((p) => p.id === session.metadata?.packId) : undefined;
  if (!userId || !pack) return { granted: false, reason: "invalid_metadata" as const };
  const granted = await grantPurchase(userId, pack.clicks, session.id);
  return { granted, reason: granted ? ("ok" as const) : ("duplicate" as const) };
}

/** Called on return from Checkout so credits show up even before the webhook lands. */
export async function confirmCheckout(user: SessionUser, sessionId: string) {
  if (paymentsMode() !== "stripe") return { creditBalance: await getBalance(user.id) };
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw badRequest("Invalid checkout session.");
  const session = await stripe<StripeSession>("GET", `/v1/checkout/sessions/${sessionId}`);
  if (session.metadata?.userId !== user.id) throw badRequest("This checkout belongs to a different account.");
  await fulfillSession(session);
  return { creditBalance: await getBalance(user.id) };
}

async function stripe<T>(method: "GET" | "POST", path: string, body?: URLSearchParams): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ApiError(503, "Stripe is not configured.", "payments_disabled");
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body && { "Content-Type": "application/x-www-form-urlencoded" }),
    },
    body,
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    console.error("[stripe]", res.status, json.error?.message);
    throw new ApiError(502, "Payment provider error — please try again.", "stripe_error");
  }
  return json;
}

/**
 * Verify a Stripe webhook signature header (`t=…,v1=…`) — HMAC-SHA256 over `${t}.${payload}`,
 * with a 5-minute replay tolerance.
 */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const signatures = header
    .split(",")
    .filter((kv) => kv.trim().startsWith("v1="))
    .map((kv) => kv.trim().slice(3));
  const t = Number(parts.t);
  if (!t || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  const exp = Buffer.from(expected, "hex");
  return signatures.some((sig) => {
    const buf = Buffer.from(sig, "hex");
    return buf.length === exp.length && timingSafeEqual(buf, exp);
  });
}
