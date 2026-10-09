import { z } from "zod";
import { api, readJson, uuidParam, type Params } from "@/lib/api/route";
import { requireAdmin } from "@/lib/auth/session";
import { deleteAd, updateAd } from "@/server/ads";

export const PATCH = api(async (req, { params }: Params<{ id: string }>) => {
  await requireAdmin();
  const { isActive } = await readJson(req, z.object({ isActive: z.boolean() }));
  return updateAd(uuidParam((await params).id, "Ad"), { isActive });
});

export const DELETE = api(async (_req, { params }: Params<{ id: string }>) => {
  await requireAdmin();
  return deleteAd(uuidParam((await params).id, "Ad"));
});
