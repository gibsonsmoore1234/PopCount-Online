import { z } from "zod";
import { api } from "@/lib/api/route";
import { requireAdmin } from "@/lib/auth/session";
import { listReports } from "@/server/reports";

export const GET = api(async (req) => {
  await requireAdmin();
  const status = z.enum(["OPEN", "ACTIONED", "DISMISSED"]).catch("OPEN").parse(req.nextUrl.searchParams.get("status"));
  return { items: await listReports(status) };
});
