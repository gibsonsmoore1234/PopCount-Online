import { api, clientIp, readJson } from "@/lib/api/route";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";
import { login } from "@/server/account";

export const POST = api(async (req) => {
  rateLimit(`auth:${clientIp(req)}`, LIMITS.auth);
  const input = await readJson(req, loginSchema);
  return login(input);
});
