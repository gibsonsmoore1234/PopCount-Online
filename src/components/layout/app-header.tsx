"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DropdownMenu } from "radix-ui";
import { Trophy, Search, LogOut, Shield, ScrollText, X, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useLogout, useMe } from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/aura/photo";
import { SearchBox } from "./search-box";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { data: me } = useMe();
  const openRankings = useUi((s) => s.openRankings);
  const [mobileSearch, setMobileSearch] = useState(false);

  return (
    <header className="border-ink fixed inset-x-0 top-0 z-[900] h-16 border-b-2 bg-white backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-5">
        <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="Pop Count — map">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg font-black transition group-hover:-rotate-6"
            style={{ background: "#000", color: "#fff", border: "2.5px solid #22c55e" }}
          >
            P
          </span>
          <span className="block leading-none">
            <span className="block text-[14px] font-black tracking-tight whitespace-nowrap sm:text-[17px]">
              Pop-Count{" "}
              <span
                style={{ color: "#0a0a0c", textShadow: "0 0 6px rgb(239 68 68 / 0.85), 0 0 14px rgb(239 68 68 / 0.6)" }}
              >
                Online
              </span>
            </span>
            <span
              className="mt-0.5 block text-[9px] font-extrabold tracking-wider whitespace-nowrap uppercase sm:text-[10px]"
              style={{ color: "#eab308" }}
            >
              What&apos;s your rating?
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

          {me && !me.isAnonymous && <AccountMenu />}
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
