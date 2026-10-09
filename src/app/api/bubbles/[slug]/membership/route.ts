import { api, type Params } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { joinBubble, leaveBubble } from "@/server/bubbles";

export const POST = api(async (_req, { params }: Params<{ slug: string }>) => {
  const user = await requireMember();
  return joinBubble(user, (await params).slug);
});

export const DELETE = api(async (_req, { params }: Params<{ slug: string }>) => {
  const user = await requireMember();
  return leaveBubble(user, (await params).slug);
});
