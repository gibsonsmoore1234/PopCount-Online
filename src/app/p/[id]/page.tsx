import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileScreen } from "@/components/profile/profile-screen";
import { getSessionUser } from "@/lib/auth/session";
import { formatAura } from "@/lib/aura";
import { getProfileDetail } from "@/server/profiles";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  return getProfileDetail(id, await getSessionUser());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await load((await params).id);
  if (!profile) return { title: "Profile not found" };
  return {
    title: `${profile.displayName} · ${formatAura(profile.auraScore)} Aura`,
    description: `${profile.displayName} (@${profile.handle}) at ${profile.bubble.name} — ${profile.voteCount} votes on Pop Count.`,
  };
}

export default async function ProfilePage({ params }: Props) {
  const profile = await load((await params).id);
  if (!profile) notFound();
  return <ProfileScreen initial={profile} />;
}
