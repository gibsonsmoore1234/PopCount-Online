"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map as MapIcon, Trophy, Search, UserRound } from "lucide-react";
import { useMe } from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

/** Phone-only bottom navigation (hidden from md up, where the header carries these actions). */
export function MobileTabBar() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const openRankings = useUi((s) => s.openRankings);
  const item = "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-extrabold uppercase";
  const active = (on: boolean) => (on ? "text-ink" : "text-muted");

  return (
    <nav
      aria-label="Primary"
      className="border-ink fixed inset-x-0 bottom-0 z-[900] flex h-16 border-t-2 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <Link href="/" className={cn(item, active(pathname === "/"))}>
        <MapIcon className="h-5 w-5" /> Map
      </Link>
      <button onClick={() => openRankings()} className={cn(item, "text-muted")}>
        <Trophy className="h-5 w-5" /> Rankings
      </button>
      <button
        onClick={() => document.querySelector<HTMLButtonElement>("button[aria-label='Search']")?.click()}
        className={cn(item, "text-muted")}
      >
        <Search className="h-5 w-5" /> Search
      </button>
      {me && (
        <Link href="/me" className={cn(item, active(pathname.startsWith("/p/")))}>
          <UserRound className="h-5 w-5" /> Me
        </Link>
      )}
    </nav>
  );
}
