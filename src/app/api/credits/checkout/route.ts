import { api, readJson } from "@/lib/api/route";
import { requireUser } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/validation";
import type { CreditPackId } from "@/lib/aura";
import { startCheckout } from "@/server/credits";

export const POST = api(async (req) => {
  const user = await requireUser();
  rateLimit(`checkout:${user.id}`, LIMITS.checkout);
  const { packId } = await readJson(req, checkoutSchema);
  const origin = process.env.APP_URL ?? req.nextUrl.origin;
  return startCheckout(user, packId as CreditPackId, origin);
});
