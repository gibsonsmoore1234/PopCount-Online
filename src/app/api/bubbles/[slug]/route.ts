import { api, type Params } from "@/lib/api/route";
import { requireAdmin } from "@/lib/auth/session";
import { deleteBubble, requireBubble } from "@/server/bubbles";

export const GET = api(async (_req, { params }: Params<{ slug: string }>) => {
  const { slug } = await params;
  return { bubble: await requireBubble(slug) };
});

export const DELETE = api(async (_req, { params }: Params<{ slug: string }>) => {
  await requireAdmin();
  const { slug } = await params;
  return deleteBubble(slug);
});
