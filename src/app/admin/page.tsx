import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminProfiles } from "@/components/admin/admin-profiles";
import { AdminAds } from "@/components/admin/admin-ads";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Moderation" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) redirect("/login?next=/admin");
  if (user.role !== "ADMIN") notFound();
  return (
    <>
      <AdminDashboard />
      <AdminProfiles />
      <div className="mx-auto max-w-5xl px-3 pb-10 sm:px-6">
        <AdminAds />
      </div>
    </>
  );
}
