import { api, readJson, uuidParam, type Params } from "@/lib/api/route";
import { getSessionUser, requireUser } from "@/lib/auth/session";
import { notFound } from "@/lib/errors";
import { updateProfileSchema } from "@/lib/validation";
import { deleteProfile, getProfileDetail, updateProfile } from "@/server/profiles";

export const GET = api(async (_req, { params }: Params<{ id: string }>) => {
  const id = uuidParam((await params).id, "Profile");
  const profile = await getProfileDetail(id, await getSessionUser());
  if (!profile) throw notFound("Profile not found.");
  return { profile };
});

export const PATCH = api(async (req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  const id = uuidParam((await params).id, "Profile");
  const input = await readJson(req, updateProfileSchema);
  await updateProfile(user, id, input);
  return { profile: await getProfileDetail(id, user) };
});

export const DELETE = api(async (_req, { params }: Params<{ id: string }>) => {
  const user = await requireUser();
  return deleteProfile(user, uuidParam((await params).id, "Profile"));
});
