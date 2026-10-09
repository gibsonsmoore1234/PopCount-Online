import { api } from "@/lib/api/route";
import { requireMember } from "@/lib/auth/session";
import { claimAdReward } from "@/server/credits";

export const POST = api(async () => claimAdReward(await requireMember()));
