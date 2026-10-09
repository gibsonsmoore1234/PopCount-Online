import { api, readJson, uuidParam, type Params } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { boostSchema } from "@/lib/validation";
import { boostProfile } from "@/server/ratings";

export const POST = api(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireMember();
  rateLimit(`boost:${user.id}`, LIMITS.boost);
  const id = uuidParam((await params).id, "Profile");
  const { clicks } = await readJson(req, boostSchema);
  return boostProfile(user, id, clicks);
});
