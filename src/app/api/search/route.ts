import { api, clientIp, readQuery } from "@/lib/api/route";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { searchQuerySchema } from "@/lib/validation";
import { search } from "@/server/profiles";

export const GET = api(async (req) => {
  rateLimit(`search:${clientIp(req)}`, LIMITS.search);
  const { q } = readQuery(req, searchQuerySchema);
  return search(q);
});
