import { api, readJson } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { createBubbleSchema } from "@/lib/validation";
import { createBubble, getBubbleBySlug, listBubbles } from "@/server/bubbles";

export const GET = api(async () => ({ bubbles: await listBubbles() }));

export const POST = api(async (req) => {
  const user = await requireMember();
  rateLimit(`create:${user.id}`, LIMITS.create);
  const input = await readJson(req, createBubbleSchema);
  const bubble = await createBubble(user, input);
  return { bubble: await getBubbleBySlug(bubble.slug) };
});
