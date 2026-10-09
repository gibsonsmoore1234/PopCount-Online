import { api, readJson, uuidParam, type Params } from "@/lib/api/route";
import { getSessionUser, requireMember } from "@/lib/auth/session";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { messageSchema } from "@/lib/validation";
import { listMessages, postMessage } from "@/server/groups";

export const GET = api(async (req, { params }: Params<{ id: string }>) => {
  const id = uuidParam((await params).id, "Group");
  const sp = req.nextUrl.searchParams;
  return listMessages(id, await getSessionUser(), {
    after: sp.get("after") ?? undefined,
    before: sp.get("before") ?? undefined,
  });
});

export const POST = api(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireMember();
  rateLimit(`message:${user.id}`, LIMITS.message);
  const id = uuidParam((await params).id, "Group");
  const { body } = await readJson(req, messageSchema);
  return { message: await postMessage(user, id, body) };
});
