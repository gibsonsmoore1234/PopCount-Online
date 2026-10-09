import { api } from "@/lib/api/route";
import { destroySession } from "@/lib/auth/session";

export const POST = api(async () => {
  await destroySession();
  return { ok: true };
});
