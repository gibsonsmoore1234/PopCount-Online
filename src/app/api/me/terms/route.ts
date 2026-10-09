import { api, readJson } from "@/lib/api/route";
import { requireUser } from "@/lib/auth/session";
import { termsSchema } from "@/lib/validation";
import { acceptTerms } from "@/server/account";

export const POST = api(async (req) => {
  const user = await requireUser();
  await readJson(req, termsSchema);
  return acceptTerms(user);
});
