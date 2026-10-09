import { z } from "zod";
import { api, readJson } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { claimAdView } from "@/server/ads";

export const POST = api(async (req) => {
  const user = await requireMember();
  const { viewId } = await readJson(req, z.object({ viewId: z.uuid() }));
  return claimAdView(user, viewId);
});
