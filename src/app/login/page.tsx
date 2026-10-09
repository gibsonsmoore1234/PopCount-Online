import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm, AuthShell } from "@/components/auth/auth-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionUser();
  // Anonymous visitors also have a session; only skip the form for a real (admin) login.
  if (user && !user.isAnonymous) redirect(user.role === "ADMIN" ? "/admin" : "/");
  return (
    <AuthShell title="Log in" subtitle="Welcome back to Pop Count.">
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  );
}
