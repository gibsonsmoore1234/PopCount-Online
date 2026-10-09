import { api, readJson } from "@/lib/api/route";
import { requireUser } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { reportSchema } from "@/lib/validation";
import { createReport } from "@/server/reports";

export const POST = api(async (req) => {
  const user = await requireUser();
  rateLimit(`report:${user.id}`, LIMITS.report);
  const input = await readJson(req, reportSchema);
  return createReport(user, input);
});
