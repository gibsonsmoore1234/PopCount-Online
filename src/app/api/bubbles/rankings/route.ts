import { api, readQuery } from "@/lib/api/route";
import { bubbleRankingQuerySchema } from "@/lib/validation";
import { bubbleRankings } from "@/server/bubbles";

export const GET = api(async (req) => {
  const { sort } = readQuery(req, bubbleRankingQuerySchema);
  return { items: await bubbleRankings(sort) };
});
