import { api, readQuery, type Params } from "@/lib/api/route";
import { feedQuerySchema } from "@/lib/validation";
import { requireBubble } from "@/server/bubbles";
import { campusFeed } from "@/server/profiles";

export const GET = api(async (req, { params }: Params<{ slug: string }>) => {
  const { slug } = await params;
  const query = readQuery(req, feedQuerySchema);
  const bubble = await requireBubble(slug);
  return campusFeed(bubble.id, query);
});
