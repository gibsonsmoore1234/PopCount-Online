import { api, uuidParam, type Params } from "@/lib/api/route";
import { requireUser } from "@/lib/auth/session";
import { deleteMessage } from "@/server/groups";

export const DELETE = api(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  return deleteMessage(user, uuidParam((await params).id, "Message"));
});
