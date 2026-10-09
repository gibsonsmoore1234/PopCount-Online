import { api } from "@/lib/api/route";
import { getSessionUser } from "@/lib/auth/session";
import { getMe } from "@/server/account";

export const GET = api(async () => {
  const user = await getSessionUser();
  return { me: user ? await getMe(user) : null };
});
