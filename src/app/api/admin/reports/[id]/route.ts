import { api, readJson, uuidParam, type Params } from "@/lib/api/route";
import { requireAdmin } from "@/lib/auth/session";
import { resolveReportSchema } from "@/lib/validation";
import { resolveReport } from "@/server/reports";

export const PATCH = api(async (req, { params }: Params<{ id: string }>) => {
  const admin = await requireAdmin();
  const id = uuidParam((await params).id, "Report");
  const { action } = await readJson(req, resolveReportSchema);
  return resolveReport(admin, id, action);
});
