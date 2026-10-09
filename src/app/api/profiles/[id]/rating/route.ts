import { api, readJson, uuidParam, type Params } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { rateSchema } from "@/lib/validation";
import { rateProfile } from "@/server/ratings";

export const PUT = api(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireMember();
  rateLimit(`vote:${user.id}`, LIMITS.vote);
  const id = uuidParam((await params).id, "Profile");
  const { value } = await readJson(req, rateSchema);
  return rateProfile(user, id, value);
});
