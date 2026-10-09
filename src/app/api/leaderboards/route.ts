import { api, readQuery } from "@/lib/api/route";
import { badRequest } from "@/lib/errors";
import { leaderboardQuerySchema } from "@/lib/validation";
import { requireBubble } from "@/server/bubbles";
import { leaderboard } from "@/server/profiles";

export const GET = api(async (req) => {
  const { scope, bubble, board } = readQuery(req, leaderboardQuerySchema);
  if (scope === "bubble") {
    if (!bubble) throw badRequest("Pass ?bubble=<slug> for bubble leaderboards.");
    const b = await requireBubble(bubble);
    return { items: await leaderboard(board, b.id) };
  }
  return { items: await leaderboard(board) };
});
