import { api, readJson, uuidParam, type Params } from "@/lib/api/route";
import { getSessionUser, requireMember } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { commentKindSchema, commentSchema } from "@/lib/validation";
import { addComment, listComments } from "@/server/comments";

export const GET = api(async (req, { params }: Params<{ id: string }>) => {
  const id = uuidParam((await params).id, "Profile");
  const sp = req.nextUrl.searchParams;
  const kind = commentKindSchema.parse(sp.get("kind") ?? "COMMENT");
  return listComments(id, kind, await getSessionUser(), sp.get("before") ?? undefined);
});

export const POST = api(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireMember();
  rateLimit(`comment:${user.id}`, LIMITS.comment);
  const id = uuidParam((await params).id, "Profile");
  const { kind, body } = await readJson(req, commentSchema);
  return { comment: await addComment(user, id, kind, body) };
});
