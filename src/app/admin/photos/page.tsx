import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminPhotoGallery } from "@/components/admin/admin-photo-gallery";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Photo Gallery" };
export const dynamic = "force-dynamic";

export default async function AdminPhotosPage() {
  const user = await getSessionUser();
  if (!user || user.isAnonymous) redirect("/login?next=/admin/photos");
  if (user.role !== "ADMIN") notFound();
  return <AdminPhotoGallery />;
}
