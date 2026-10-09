import { api, uuidParam, type Params } from "@/lib/api/route";
import { requireUser } from "@/lib/auth/session";
import { deleteComment } from "@/server/comments";

export const DELETE = api(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  return deleteComment(user, uuidParam((await params).id, "Comment"));
});
