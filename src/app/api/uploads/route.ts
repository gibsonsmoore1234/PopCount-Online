import { api } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { badRequest } from "@/lib/errors";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { saveImage } from "@/server/images";

export const POST = api(async (req) => {
  const user = await requireMember();
  rateLimit(`upload:${user.id}`, LIMITS.upload);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Attach an image file as `file`.");
  return saveImage(user.id, file);
});
