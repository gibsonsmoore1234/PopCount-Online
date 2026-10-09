import { z } from "zod";
import { api, readJson } from "@/lib/api/route";
import { requireUser } from "@/lib/auth/session";
import { confirmCheckout } from "@/server/credits";

export const POST = api(async (req) => {
  const user = await requireUser();
  const { sessionId } = await readJson(req, z.object({ sessionId: z.string().min(1).max(255) }));
  return confirmCheckout(user, sessionId);
});
