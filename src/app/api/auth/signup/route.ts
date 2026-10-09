import { api } from "@/lib/api/route";
import { notFound } from "@/lib/errors";

/** Sign-up is disabled: every visitor is anonymous. (Admins log in at /login.) */
export const POST = api(async () => {
  throw notFound("Sign-up is not available.");
});
