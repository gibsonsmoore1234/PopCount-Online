import { api, readJson, type Params } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { createGroupSchema } from "@/lib/validation";
import { requireBubble } from "@/server/bubbles";
import { createGroup, listGroups } from "@/server/groups";

export const GET = api(async (_req, { params }: Params<{ slug: string }>) => {
  const bubble = await requireBubble((await params).slug);
  return { groups: await listGroups(bubble.id) };
});

export const POST = api(async (req, { params }: Params<{ slug: string }>) => {
  const user = await requireMember();
  rateLimit(`create:${user.id}`, LIMITS.create);
  const bubble = await requireBubble((await params).slug);
  const input = await readJson(req, createGroupSchema);
  return { group: await createGroup(user, bubble.id, input) };
});
