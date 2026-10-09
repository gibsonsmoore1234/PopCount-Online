import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/layout/app-header";
import { TermsGate } from "@/components/onboarding/terms-gate";
import { AuthPrompt } from "@/components/auth/auth-prompt";
import { RankingsDialog } from "@/components/rankings/rankings";
import { GlobalProfileForm } from "@/components/profile/profile-form";
import { BuyCreditsDialog } from "@/components/credits/buy-credits-dialog";
import { getSessionUser } from "@/lib/auth/session";
import { getMe } from "@/server/account";
import { TERMS_COOKIE, TERMS_VERSION } from "@/lib/terms";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Pop Count — Live Popularity Map", template: "%s · Pop Count" },
  description:
    "Opt in, drop into any bubble, and see where your popularity lands. Live 0–100 ratings, leaderboards and group threads on an interactive map.",
  applicationName: "Pop Count",
  openGraph: {
    title: "Pop Count",
    description: "Live popularity ratings on an interactive map.",
    siteName: "popcount.ai",
    type: "website",
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Pop Count" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [jar, user] = await Promise.all([cookies(), getSessionUser()]);
  const me = user ? await getMe(user) : null;
  const termsAccepted = jar.get(TERMS_COOKIE)?.value === TERMS_VERSION || Boolean(me?.termsAccepted);

  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Providers me={me}>
          <a
            href="#main"
            className="bg-ink sr-only z-[3000] rounded-lg px-3 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>
          <AppHeader />
          <main id="main" className="pt-16 pb-[env(safe-area-inset-bottom)]">
            {children}
          </main>
          <TermsGate initiallyAccepted={termsAccepted} />
          <AuthPrompt />
          <RankingsDialog />
          <GlobalProfileForm />
          <BuyCreditsDialog />
        </Providers>
      </body>
    </html>
  );
}
