"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { Trophy, Flame, TrendingDown, Users, Activity, MapPin, Vote } from "lucide-react";
import { useBubbleRankings, useLeaderboard } from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Pills } from "@/components/ui/pills";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { AuraBadge } from "@/components/aura/aura";
import { Avatar } from "@/components/aura/photo";
import { BubbleLogo } from "@/components/aura/bubble-logo";
import { auraColor, formatCount } from "@/lib/aura";
import type { BubbleSort, LeaderboardId } from "@/lib/validation";
import type { BubbleRankingEntry, RankedProfile } from "@/types/api";
import { cn, genderLabel, plural } from "@/lib/utils";

export const NATIONAL_BOARDS: { value: LeaderboardId; label: string }[] = [
  { value: "top_overall", label: "Top 50 Overall" },
  { value: "bottom_overall", label: "Bottom 50 Overall" },
  { value: "top_males", label: "Top 100 Males" },
  { value: "top_females", label: "Top 100 Females" },
];

export const LOCAL_BOARDS: { value: LeaderboardId; label: string }[] = [
  { value: "top_overall", label: "Top 25 Overall" },
  { value: "bottom_overall", label: "Bottom 25 Overall" },
  { value: "top_males", label: "Top 50 Males" },
  { value: "top_females", label: "Top 50 Females" },
];

const BUBBLE_SORTS: { value: BubbleSort; label: string }[] = [
  { value: "active", label: "Most Active" },
  { value: "highest", label: "Highest Avg %" },
  { value: "lowest", label: "Lowest Avg %" },
  { value: "votes", label: "Total Votes" },
];

/** Global leaderboards: Top Profiles (national boards) + Campus Bubbles (bubble rankings). */
export function RankingsPanel({ onNavigate }: { onNavigate?: () => void }) {
  const tab = useUi((s) => s.rankingsTab);
  const openRankings = useUi((s) => s.openRankings);
  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Rankings" className="border-ink flex gap-1 border-b-2 px-4 pt-2 sm:px-5">
        {(
          [
            ["profiles", "Top Profiles", Trophy],
            ["bubbles", "Campus Bubbles", MapPin],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => openRankings(id)}
            className={cn(
              "-mb-0.5 flex items-center gap-1.5 border-b-4 px-3 py-2.5 text-xs font-black tracking-tight uppercase transition sm:text-sm",
              tab === id ? "border-ink text-ink" : "text-muted hover:text-ink border-transparent",
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.5} /> {label}
          </button>
        ))}
      </div>
      <div className="flex-1 p-4 sm:p-5">
        {tab === "profiles" ? (
          <ProfileBoards scope="national" onNavigate={onNavigate} />
        ) : (
          <BubbleBoards onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}

export function ProfileBoards({
  scope,
  bubbleSlug,
  onNavigate,
}: {
  scope: "national" | "bubble";
  bubbleSlug?: string;
  onNavigate?: () => void;
}) {
  const [board, setBoard] = useState<LeaderboardId>("top_overall");
  const { data, isPending, isError, error, refetch } = useLeaderboard(scope, board, bubbleSlug);
  const options = scope === "national" ? NATIONAL_BOARDS : LOCAL_BOARDS;
  const byVolume = board === "top_males" || board === "top_females";

  return (
    <div className="space-y-3">
      <Pills ariaLabel="Leaderboard" value={board} onChange={setBoard} options={options} />
      <p className="text-muted text-[11px] font-bold">
        {byVolume
          ? "Ranked by total vote volume (boosts included)."
          : board === "bottom_overall"
            ? "Lowest rating first · min. 3 votes to qualify."
            : "Highest rating first · min. 3 votes to qualify."}
      </p>
      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title="No one ranked yet"
          body="Profiles appear here once they've collected a few votes."
        />
      ) : (
        <ol className="space-y-2">
          {data.map((p, i) => (
            <ProfileRow key={p.id} p={p} index={i} byVolume={byVolume} onNavigate={onNavigate} />
          ))}
        </ol>
      )}
    </div>
  );
}

function ProfileRow({
  p,
  index,
  byVolume,
  onNavigate,
}: {
  p: RankedProfile;
  index: number;
  byVolume: boolean;
  onNavigate?: () => void;
}) {
  const medal = p.rank <= 3 ? ["bg-aura-high", "bg-aura-mid", "bg-[#ffd6b0]"][p.rank - 1] : "bg-white";
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.02 }}
    >
      <Link
        href={`/p/${p.id}`}
        onClick={onNavigate}
        className="border-ink shadow-hard-sm hover:bg-surface flex items-center gap-3 rounded-xl border-2 bg-white p-2.5 transition hover:-translate-y-0.5"
      >
        <span
          className={cn(
            "border-ink grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 text-xs font-black tabular-nums",
            medal,
          )}
        >
          {p.rank}
        </span>
        <Avatar src={p.photoUrl} name={p.displayName} size={40} className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black tracking-tight uppercase">{p.displayName}</p>
          <p className="text-muted truncate text-[11px] font-semibold">
            {p.bubble.name} · {p.affiliation ?? genderLabel(p.gender)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {byVolume ? (
            <>
              <span className="text-sm font-black tabular-nums">{formatCount(p.voteCount)} votes</span>
              <AuraBadge score={p.auraScore} size="sm" />
            </>
          ) : (
            <>
              <AuraBadge score={p.auraScore} size="md" />
              <span className="text-muted text-[10px] font-bold">{plural(p.voteCount, "vote")}</span>
            </>
          )}
        </div>
      </Link>
    </motion.li>
  );
}

function BubbleBoards({ onNavigate }: { onNavigate?: () => void }) {
  const [sort, setSort] = useState<BubbleSort>("active");
  const router = useRouter();
  const { data, isPending, isError, error, refetch } = useBubbleRankings(sort);
  const icons = { active: Activity, highest: Flame, lowest: TrendingDown, votes: Vote };

  return (
    <div className="space-y-3">
      <Pills
        ariaLabel="Sort bubbles"
        value={sort}
        onChange={setSort}
        options={BUBBLE_SORTS.map((o) => {
          const Icon = icons[o.value];
          return { ...o, icon: <Icon className="h-3.5 w-3.5" strokeWidth={2.5} /> };
        })}
      />
      {isPending ? (
        <ListSkeleton />
      ) : isError ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="No bubbles yet"
          body="Drop the first pin on the map."
        />
      ) : (
        <ol className="grid gap-2.5 sm:grid-cols-2">
          {data.map((b) => (
            <BubbleCard
              key={b.id}
              b={b}
              sort={sort}
              onClick={() => {
                onNavigate?.();
                router.push(`/b/${b.slug}`);
              }}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function BubbleCard({ b, sort, onClick }: { b: BubbleRankingEntry; sort: BubbleSort; onClick: () => void }) {
  return (
    <li>
      <button
        onClick={onClick}
        className="border-ink shadow-hard-sm hover:shadow-hard flex w-full items-center gap-3 rounded-xl border-2 bg-white p-3 text-left transition hover:-translate-y-0.5"
      >
        <span className="w-6 shrink-0 text-center text-base font-black tabular-nums">{b.rank}</span>
        <BubbleLogo name={b.name} logoUrl={b.logoUrl} avgAura={b.avgAura} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black tracking-tight uppercase">{b.name}</p>
          <p className="text-muted truncate text-[11px] font-semibold">
            {b.countyName}, {b.stateName}
          </p>
          <div className="text-ink-2 mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-extrabold uppercase">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {b.profileCount} profiles
            </span>
            <span>{formatCount(b.totalVotes)} votes</span>
            {sort === "active" && <span className="text-[#2f6b1f]">+{formatCount(b.recentVotes)} this week</span>}
          </div>
        </div>
        <span
          className="border-ink grid h-12 w-16 shrink-0 place-items-center rounded-xl border-2 text-center font-black tabular-nums"
          style={{ background: auraColor(b.avgAura) }}
        >
          <span className="text-sm leading-none">{b.avgAura === null ? "—" : `${b.avgAura.toFixed(1)}%`}</span>
          <span className="text-[8px] leading-none font-extrabold uppercase">avg</span>
        </span>
      </button>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="border-line h-16 border-2" />
      ))}
    </div>
  );
}

/** Modal shell opened from the header's "National Rankings" button. */
export function RankingsDialog() {
  const open = useUi((s) => s.rankingsOpen);
  const close = useUi((s) => s.closeRankings);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        title={
          <span className="flex items-center gap-2">
            <Trophy className="h-5 w-5" strokeWidth={2.5} /> National Rankings
          </span>
        }
        description="Live leaderboards across every bubble on the map."
        size="xl"
        className="h-[min(92dvh,900px)]"
      >
        <RankingsPanel onNavigate={close} />
      </DialogContent>
    </Dialog>
  );
}
