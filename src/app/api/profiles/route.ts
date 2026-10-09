import { api, readJson } from "@/lib/api/route";
import { requireAccount } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { createProfileSchema } from "@/lib/validation";
import { createProfile } from "@/server/profiles";

export const POST = api(async (req) => {
  const user = await requireAccount();
  rateLimit(`create:${user.id}`, LIMITS.create);
  const input = await readJson(req, createProfileSchema);
  return { profile: await createProfile(user, input) };
});
