import { api, readJson } from "@/lib/api/route";
import { requireAdmin } from "@/lib/auth/session";
import { adSchema } from "@/lib/validation";
import { createAd, listAds } from "@/server/ads";

export const GET = api(async () => {
  await requireAdmin();
  return { items: await listAds() };
});

export const POST = api(async (req) => {
  await requireAdmin();
  const input = await readJson(req, adSchema);
  return { ad: await createAd({ ...input, clickUrl: input.clickUrl || undefined }) };
});
