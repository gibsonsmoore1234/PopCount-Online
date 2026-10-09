import { api } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { startAdView } from "@/server/ads";

export const POST = api(async () => {
  const user = await requireMember();
  rateLimit(`ad:${user.id}`, LIMITS.vote);
  return startAdView(user);
});
