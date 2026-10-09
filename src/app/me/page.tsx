import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { profileIdForUser } from "@/server/profiles";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/me");
  const id = await profileIdForUser(user.id);
  redirect(id ? `/p/${id}` : "/?create=1");
}
