import { api, type Params } from "@/lib/api/route";
import { requireBubble } from "@/server/bubbles";

export const GET = api(async (_req, { params }: Params<{ slug: string }>) => {
  const { slug } = await params;
  return { bubble: await requireBubble(slug) };
});
