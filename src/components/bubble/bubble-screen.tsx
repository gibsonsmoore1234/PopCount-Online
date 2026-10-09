"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Vote, Sparkles, Plus, MapPin, Search, Flag } from "lucide-react";
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
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";
import { ReportDialog } from "@/components/profile/report-dialog";

const SORTS: { value: FeedSort; label: string }[] = [
  { value: "random", label: "Random" },
  { value: "best", label: "Best %" },
  { value: "lowest", label: "Lowest %" },
  { value: "most_votes", label: "Most Known" },
  { value: "least_votes", label: "Least Known" },
];

type GenderFilter = "" | "MALE" | "FEMALE";
const GENDERS: { value: GenderFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

/** Layer 2 — full-screen campus feed that completely replaces the map. */
export function BubbleScreen({
  initialBubble,
  initialFeed,
  seed,
}: {
  initialBubble: BubbleSummary;
  initialFeed: Page<Card>;
  seed: string;
}) {
  const { data: bubble = initialBubble } = useBubble(initialBubble.slug, initialBubble);

  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-white">
      <BubbleHeader bubble={bubble} />

      <div className="mx-auto max-w-[1400px] px-3 py-5 sm:px-6">
        <Roster bubble={bubble} initialFeed={initialFeed} seed={seed} />
      </div>
    </div>
  );
}

function BubbleHeader({ bubble }: { bubble: BubbleSummary }) {
  const { data: me } = useMe();
  const openProfileForm = useUi((s) => s.openProfileForm);
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
            <Button size="sm" onClick={() => openProfileForm(bubble.id)}>
              <Plus className="h-4 w-4" strokeWidth={3} /> Create Profile here
            </Button>
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label="Report this bubble"
              onClick={() => setReportOpen(true)}
            >
              <Flag className="h-4 w-4" strokeWidth={2.5} />
            </Button>
            <AdminDeleteButton kind="bubble" slug={bubble.slug} name={bubble.name} />
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
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="BUBBLE"
        targetId={bubble.id}
        subject={bubble.name}
      />
    </header>
  );
}

function Roster({ bubble, initialFeed, seed }: { bubble: BubbleSummary; initialFeed: Page<Card>; seed: string }) {
  const [sort, setSort] = useState<FeedSort>("random");
  const [gender, setGender] = useState<GenderFilter>("");
  const [q, setQ] = useState("");
  const debounced = useDebounced(q.trim(), 250);
  const isDefault = sort === "random" && gender === "" && debounced === "";
  const feed = useFeed(bubble.slug, sort, debounced, isDefault ? initialFeed : undefined, seed, gender);
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
        <div className="flex flex-col gap-2">
          <Pills ariaLabel="Sort people" value={sort} onChange={setSort} options={SORTS} />
          <Pills ariaLabel="Filter by gender" value={gender} onChange={setGender} options={GENDERS} />
        </div>
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
            <Button size="sm" onClick={() => openProfileForm(bubble.id)}>
              <Plus className="h-4 w-4" strokeWidth={3} /> Create your profile
            </Button>
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
              <ProfileCard
                key={p.id}
                p={p}
                rank={debounced || sort === "random" ? undefined : i + 1}
                priority={i < 8}
              />
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
