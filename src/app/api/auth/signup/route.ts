import { api, clientIp, readJson } from "@/lib/api/route";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { signupSchema } from "@/lib/validation";
import { signup } from "@/server/account";

export const POST = api(async (req) => {
  rateLimit(`auth:${clientIp(req)}`, LIMITS.auth);
  const input = await readJson(req, signupSchema);
  return signup(input);
});
