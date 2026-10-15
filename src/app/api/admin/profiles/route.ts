import { getSessionUser } from "@/lib/auth/session";
import { forbidden } from "@/lib/errors";
import { getAllProfiles } from "@/server/profiles";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    throw forbidden("Admin access required");
  }

  const profiles = await getAllProfiles();
  return Response.json({ profiles });
}
