import { api, type Params } from "@/lib/api/route";
import { requireAdmin } from "@/lib/auth/session";
import { z } from "zod";
import { readJson } from "@/lib/api/route";
import { deleteBubble, requireBubble, updateBubble } from "@/server/bubbles";

export const GET = api(async (_req, { params }: Params<{ slug: string }>) => {
  const { slug } = await params;
  return { bubble: await requireBubble(slug) };
});

export const DELETE = api(async (_req, { params }: Params<{ slug: string }>) => {
  await requireAdmin();
  const { slug } = await params;
  return deleteBubble(slug);
});

const patchSchema = z.object({
  name: z.string().max(48).optional(),
  logoUrl: z
    .string()
    .regex(/^\/api\/images\/[0-9a-f-]{36}$/i)
    .nullable()
    .optional(),
});

export const PATCH = api(async (req, { params }: Params<{ slug: string }>) => {
  await requireAdmin();
  const { slug } = await params;
  return updateBubble(slug, await readJson(req, patchSchema));
});
