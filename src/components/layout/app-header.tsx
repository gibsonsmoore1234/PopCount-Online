"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import {
  Trophy,
  Search,
  UserRound,
  LogOut,
  Shield,
  Zap,
  ScrollText,
  X,
  ChevronDown,
  Map as MapIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLogout, useMe } from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { formatCents } from "@/lib/aura";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/aura/photo";
import { SearchBox } from "./search-box";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { data: me } = useMe();
  const openRankings = useUi((s) => s.openRankings);
  const setCreditsOpen = useUi((s) => s.setCreditsOpen);
  const [mobileSearch, setMobileSearch] = useState(false);

  return (
    <header className="border-ink fixed inset-x-0 top-0 z-[900] h-16 border-b-2 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="Pop Count — map">
          <span className="border-ink bg-ink shadow-hard-sm grid h-9 w-9 place-items-center rounded-xl border-2 text-lg font-black text-white transition group-hover:-rotate-6">
            P
          </span>
          <span className="hidden leading-none sm:block">
            <span className="block text-[17px] font-black tracking-tight">Pop Count</span>
            <span className="text-muted mt-0.5 flex items-center gap-1 text-[10px] font-extrabold tracking-wider uppercase">
              <span className="animate-pulse-ring bg-aura-high h-1.5 w-1.5 rounded-full" /> Live map
            </span>
          </span>
        </Link>

        <SearchBox className="ml-2 hidden max-w-md flex-1 md:block" />
        <div className="flex-1 md:hidden" />

        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="secondary"
            size="icon-sm"
            className="md:hidden"
            aria-label="Search"
            onClick={() => setMobileSearch(true)}
          >
            <Search className="h-4 w-4" strokeWidth={3} />
          </Button>

          <Button variant="secondary" size="sm" onClick={() => openRankings()} aria-label="National rankings">
            <Trophy className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden lg:inline">National Rankings</span>
          </Button>

          {me?.profile ? (
            <Button asChild variant="aura" size="sm" className="hidden sm:inline-flex">
              <Link href={`/p/${me.profile.id}`}>
                <UserRound className="h-4 w-4" strokeWidth={2.5} /> My Profile
              </Link>
            </Button>
          ) : null}

          {me && (
            <button
              onClick={() => setCreditsOpen(true)}
              className="border-ink bg-aura-high shadow-hard-sm flex h-8 items-center gap-1 rounded-xl border-2 px-2 text-xs font-black tabular-nums transition hover:brightness-95"
              aria-label={`Boost credit ${formatCents(me.creditBalance)} — buy more`}
            >
              <Zap className="fill-ink h-3.5 w-3.5" strokeWidth={2.5} />
              {formatCents(me.creditBalance)}
            </button>
          )}

          {me && <AccountMenu />}
        </nav>
      </div>

      {mobileSearch && (
        <div className="border-ink absolute inset-x-0 top-0 z-[1100] flex h-16 items-center gap-2 border-b-2 bg-white px-3 md:hidden">
          <SearchBox className="flex-1" autoFocus onNavigate={() => setMobileSearch(false)} />
          <Button variant="secondary" size="icon-sm" aria-label="Close search" onClick={() => setMobileSearch(false)}>
            <X className="h-4 w-4" strokeWidth={3} />
          </Button>
        </div>
      )}
    </header>
  );
}

function AccountMenu() {
  const { data: me } = useMe();
  const logout = useLogout();
  const router = useRouter();
  const setCreditsOpen = useUi((s) => s.setCreditsOpen);
  if (!me) return null;

  const item =
    "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-extrabold outline-none data-[highlighted]:bg-surface-2";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="border-ink shadow-hard-sm hover:bg-surface-2 flex h-8 items-center gap-1 rounded-xl border-2 bg-white pr-1.5 pl-0.5 transition"
          aria-label="Account menu"
        >
          <Avatar src={me.profile?.photoUrl} name={me.profile?.displayName ?? me.handle} size={24} className="border" />
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="border-ink shadow-hard animate-slide-up z-[1300] min-w-56 rounded-2xl border-2 bg-white p-1.5"
        >
          <div className="px-2.5 pt-1.5 pb-2">
            <p className="truncate text-sm font-black">@{me.handle}</p>
            <p className="text-muted truncate text-[11px] font-semibold">{me.email}</p>
          </div>
          <DropdownMenu.Separator className="bg-line my-1 h-0.5" />
          {me.profile ? (
            <DropdownMenu.Item className={item} onSelect={() => router.push(`/p/${me.profile!.id}`)}>
              <UserRound className="h-4 w-4" /> My profile
            </DropdownMenu.Item>
          ) : null}
          {me.profile && (
            <DropdownMenu.Item className={item} onSelect={() => router.push(`/b/${me.profile!.bubbleSlug}`)}>
              <MapIcon className="h-4 w-4" /> {me.profile.bubbleName}
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className={item} onSelect={() => setCreditsOpen(true)}>
            <Zap className="h-4 w-4" /> Boost credit · {formatCents(me.creditBalance)}
          </DropdownMenu.Item>
          {me.role === "ADMIN" && (
            <DropdownMenu.Item className={item} onSelect={() => router.push("/admin")}>
              <Shield className="h-4 w-4" /> Moderation queue
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item className={item} onSelect={() => router.push("/guidelines")}>
            <ScrollText className="h-4 w-4" /> Guidelines & terms
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="bg-line my-1 h-0.5" />
          <DropdownMenu.Item
            className={cn(item, "text-[#9b2c2c]")}
            onSelect={() =>
              logout.mutate(undefined, {
                onSuccess: () => {
                  toast("Logged out — see you soon.");
                  router.refresh();
                },
              })
            }
          >
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
