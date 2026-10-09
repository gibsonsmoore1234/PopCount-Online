import { z } from "zod";
import { api, readJson, uuidParam, type Params } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { reactToComment } from "@/server/comments";

const schema = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });

export const POST = api(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireMember();
  rateLimit(`react:${user.id}`, LIMITS.vote);
  const { value } = await readJson(req, schema);
  return reactToComment(user, uuidParam((await params).id, "Comment"), value);
});
