import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm, AuthShell } from "@/components/auth/auth-form";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign up" };
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <AuthShell title="Join Pop Count" subtitle="Free · 100 clicks to start · 18+ only.">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
