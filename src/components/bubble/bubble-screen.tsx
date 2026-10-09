"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Vote,
  Sparkles,
  Plus,
  MapPin,
  Search,
  LayoutGrid,
  Trophy,
  MessagesSquare,
  Flag,
} from "lucide-react";
import { useBubble, useFeed, useMe } from "@/hooks/api";
import { useDebounced } from "@/hooks/use-gate";
import { useUi } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Pills } from "@/components/ui/pills";
import { EmptyState, ErrorState, StatTile, Spinner } from "@/components/ui/misc";
import { BubbleLogo } from "@/components/aura/bubble-logo";
import { auraColor, formatAura, formatCount } from "@/lib/aura";
import type { FeedSort } from "@/lib/validation";
import type { BubbleSummary, Page, ProfileCard as Card } from "@/types/api";
import { ProfileCard, ProfileCardSkeleton } from "./profile-card";
import { ProfileBoards } from "@/components/rankings/rankings";
import { GroupsPanel } from "./groups-panel";
import { ReportDialog } from "@/components/profile/report-dialog";
import { cn } from "@/lib/utils";

const SORTS: { value: FeedSort; label: string }[] = [
  { value: "best", label: "Best %" },
  { value: "males", label: "Top Males" },
  { value: "females", label: "Top Females" },
  { value: "lowest", label: "Lowest %" },
  { value: "most_votes", label: "Most Votes" },
  { value: "least_votes", label: "Least Votes" },
];

type Tab = "roster" | "leaderboards" | "groups";

/** Layer 2 — full-screen campus feed that completely replaces the map. */
export function BubbleScreen({
  initialBubble,
  initialFeed,
}: {
  initialBubble: BubbleSummary;
  initialFeed: Page<Card>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (
    ["roster", "leaderboards", "groups"].includes(params.get("tab") ?? "") ? params.get("tab") : "roster"
  ) as Tab;
  const { data: bubble = initialBubble } = useBubble(initialBubble.slug, initialBubble);

  const setTab = (t: Tab) => {
    const sp = new URLSearchParams(params);
    if (t === "roster") sp.delete("tab");
    else sp.set("tab", t);
    sp.delete("g");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-white">
      <BubbleHeader bubble={bubble} />

      <div className="border-ink sticky top-16 z-[400] border-b-2 bg-white backdrop-blur">
        <div
          role="tablist"
          aria-label={`${bubble.name} sections`}
          className="pc-no-scrollbar mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-3 sm:px-6"
        >
          {(
            [
              ["roster", "Roster", LayoutGrid],
              ["leaderboards", "Leaderboards", Trophy],
              ["groups", "Groups", MessagesSquare],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "-mb-0.5 flex shrink-0 items-center gap-1.5 border-b-4 px-3 py-3 text-xs font-black tracking-tight uppercase transition sm:text-sm",
                tab === id ? "border-ink" : "text-muted hover:text-ink border-transparent",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-3 py-5 sm:px-6">
        {tab === "roster" && <Roster bubble={bubble} initialFeed={initialFeed} />}
        {tab === "leaderboards" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-3 text-lg font-black tracking-tight uppercase">{bubble.name} leaderboards</h2>
            <ProfileBoards scope="bubble" bubbleSlug={bubble.slug} />
          </div>
        )}
        {tab === "groups" && <GroupsPanel bubble={bubble} />}
      </div>
    </div>
  );
}

function BubbleHeader({ bubble }: { bubble: BubbleSummary }) {
  const { data: me } = useMe();
  const openProfileForm = useUi((s) => s.openProfileForm);
  const promptAuth = useUi((s) => s.promptAuth);
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <header className="border-ink bg-surface border-b-2">
      <div className="mx-auto max-w-[1400px] space-y-4 px-3 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" strokeWidth={3} /> Back to Map
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
            {me && !me.profile && (
              <Button size="sm" onClick={() => openProfileForm(bubble.id)}>
                <Plus className="h-4 w-4" strokeWidth={3} /> Create Profile here
              </Button>
            )}
            {!me && (
              <Button size="sm" onClick={() => promptAuth(`Create an account to post your profile in ${bubble.name}.`)}>
                <Plus className="h-4 w-4" strokeWidth={3} /> Create Profile
              </Button>
            )}
            {me && (
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label="Report this bubble"
                onClick={() => setReportOpen(true)}
              >
                <Flag className="h-4 w-4" strokeWidth={2.5} />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <BubbleLogo
              name={bubble.name}
              logoUrl={bubble.logoUrl}
              avgAura={bubble.avgAura}
              size={64}
              className="shadow-hard-sm"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-black tracking-tight uppercase sm:text-4xl">{bubble.name}</h1>
                {bubble.badge && (
                  <span className="border-ink bg-aura-mid rounded-lg border-2 px-2 py-0.5 text-[10px] font-black uppercase sm:text-xs">
                    {bubble.badge}
                  </span>
                )}
              </div>
              <p className="text-muted mt-1 flex items-center gap-1 text-xs font-bold">
                <MapPin className="h-3.5 w-3.5" /> {bubble.countyName} County, {bubble.stateName}
              </p>
              {bubble.description && (
                <p className="text-ink-2 mt-1 max-w-xl text-sm font-semibold">{bubble.description}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-[440px]">
            <StatTile label="People" value={formatCount(bubble.profileCount)} />
            <StatTile label="Bubble avg" value={formatAura(bubble.avgAura)} accent={auraColor(bubble.avgAura)} />
            <StatTile label="Total votes" value={formatCount(bubble.totalVotes)} />
          </div>
        </div>
      </div>
      {me && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="BUBBLE"
          targetId={bubble.id}
          subject={bubble.name}
        />
      )}
    </header>
  );
}

function Roster({ bubble, initialFeed }: { bubble: BubbleSummary; initialFeed: Page<Card> }) {
  const [sort, setSort] = useState<FeedSort>("best");
  const [q, setQ] = useState("");
  const debounced = useDebounced(q.trim(), 250);
  const isDefault = sort === "best" && debounced === "";
  const feed = useFeed(bubble.slug, sort, debounced, isDefault ? initialFeed : undefined);
  const sentinel = useRef<HTMLDivElement>(null);
  const openProfileForm = useUi((s) => s.openProfileForm);
  const { data: me } = useMe();

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feed]);

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Pills ariaLabel="Sort roster" value={sort} onChange={setSort} options={SORTS} />
        <label className="border-ink focus-within:shadow-hard-sm flex h-9 w-full items-center gap-2 rounded-xl border-2 bg-white px-3 lg:w-72">
          <Search className="h-4 w-4 shrink-0" strokeWidth={3} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${bubble.name}…`}
            aria-label={`Search people in ${bubble.name}`}
            className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold focus:outline-none"
          />
          {feed.isFetching && !feed.isFetchingNextPage && <Spinner className="text-muted h-3.5 w-3.5" />}
        </label>
      </div>

      {feed.isPending ? (
        <Grid>
          {Array.from({ length: 10 }, (_, i) => (
            <ProfileCardSkeleton key={i} />
          ))}
        </Grid>
      ) : feed.isError ? (
        <ErrorState message={feed.error.message} onRetry={() => feed.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title={debounced ? "No matches" : "No profiles found"}
          body={
            debounced
              ? `Nobody in ${bubble.name} matches “${debounced}”.`
              : "Nobody matches this filter yet — be the first."
          }
          action={
            !me?.profile && (
              <Button size="sm" onClick={() => openProfileForm(bubble.id)}>
                <Plus className="h-4 w-4" strokeWidth={3} /> Create your profile
              </Button>
            )
          }
        />
      ) : (
        <>
          <p className="text-muted text-[11px] font-extrabold tracking-wider uppercase">
            <Vote className="mr-1 inline h-3.5 w-3.5" />
            Showing {items.length}
            {feed.hasNextPage ? "+" : ""} {items.length === 1 ? "profile" : "profiles"}
          </p>
          <Grid>
            {items.map((p, i) => (
              <ProfileCard key={p.id} p={p} priority={i < 8} />
            ))}
          </Grid>
        </>
      )}
      <div ref={sentinel} className="flex justify-center py-4">
        {feed.isFetchingNextPage && <Spinner className="h-5 w-5" />}
      </div>
    </div>
  );
}

/** Non-overlapping responsive grid: rows size to their content, items align to the top. */
function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid [grid-auto-rows:max-content] auto-rows-max grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {children}
    </div>
  );
}
