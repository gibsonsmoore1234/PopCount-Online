"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, AnimatePresence } from "motion/react";
import { Slider } from "radix-ui";
import { Flame, ThumbsDown, Zap, Info } from "lucide-react";
import { toast } from "sonner";
import { useBoost, useMe, useRate } from "@/hooks/api";
import { useAuthGuard } from "@/hooks/use-gate";
import { useUi } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import {
  AURA_COLORS,
  BOOST_COST_CENTS,
  BOOST_DAILY_CAP,
  DOWNVOTE_VALUE,
  UPVOTE_VALUE,
  auraTier,
  formatCents,
  tierLabel,
} from "@/lib/aura";
import { errorMessage } from "@/lib/api/client";
import type { ProfileDetail } from "@/types/api";
import { cn } from "@/lib/utils";

export function AnimatedNumber({
  value,
  decimals = 1,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const controls = animate(prev.current, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => (el.textContent = v.toFixed(decimals)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, decimals]);
  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}
    </span>
  );
}

/** Rating actions: quick 🔥/👎 votes, an exact 0–100 Aura slider, and the up/down tally. */
export function VoteConsole({ profile }: { profile: ProfileDetail }) {
  const rate = useRate(profile.id);
  const guard = useAuthGuard();
  // `null` = untouched → follow the viewer's saved rating as it changes.
  const [touched, setDraft] = useState<number | null>(null);
  const draft = touched ?? profile.myRating?.value ?? 70;
  const tier = auraTier(draft);

  const cast = (value: number, label: string) => {
    if (!guard(`Create an account to rate ${profile.displayName}.`)) return;
    rate.mutate(value, {
      onSuccess: () => {
        setDraft(null);
        toast.success(label);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const total = profile.upCount + profile.downCount;
  const upPct = total ? (profile.upCount / total) * 100 : 50;

  return (
    <div className="border-ink shadow-hard space-y-4 rounded-2xl border-2 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black tracking-tight uppercase">Rate their Aura</h2>
        <span className="text-muted text-[11px] font-extrabold uppercase">
          {profile.voteCount.toLocaleString()} total votes
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="aura"
          size="lg"
          onClick={() => cast(UPVOTE_VALUE, "🔥 Upvote cast — rated 100")}
          disabled={rate.isPending}
        >
          <Flame className="h-5 w-5" strokeWidth={2.5} /> Upvote
        </Button>
        <Button
          variant="danger"
          size="lg"
          onClick={() => cast(DOWNVOTE_VALUE, "👎 Downvote cast — rated 0")}
          disabled={rate.isPending}
        >
          <ThumbsDown className="h-5 w-5" strokeWidth={2.5} /> Downvote
        </Button>
      </div>

      <div className="border-ink bg-surface space-y-2 rounded-xl border-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold tracking-wider uppercase">Exact Aura</span>
          <span
            className="border-ink rounded-lg border-2 px-2 py-0.5 text-sm font-black tabular-nums"
            style={{ background: AURA_COLORS[tier] }}
          >
            {draft} · {tierLabel(tier)}
          </span>
        </div>
        <Slider.Root
          value={[draft]}
          onValueChange={([v]) => setDraft(v)}
          min={0}
          max={100}
          step={1}
          aria-label="Aura rating"
          className="relative flex h-6 w-full touch-none items-center select-none"
        >
          <Slider.Track className="border-ink relative h-3 grow overflow-hidden rounded-full border-2 bg-[linear-gradient(90deg,#C86363_0%,#C86363_33.9%,#FFF699_34%,#FFF699_66.9%,#A8F093_67%,#A8F093_100%)]">
            <Slider.Range className="bg-ink/15 absolute h-full" />
          </Slider.Track>
          <Slider.Thumb className="border-ink shadow-hard-sm block h-6 w-6 rounded-full border-[3px] bg-white transition-transform focus:outline-none focus-visible:scale-110" />
        </Slider.Root>
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted text-[11px] font-semibold">
            {profile.myRating ? (
              <>
                Your rating: <b className="text-ink">{profile.myRating.value}</b>
                {profile.myRating.weight > 1 && <> · weight ×{profile.myRating.weight}</>}
              </>
            ) : (
              "One free rating per person — change it any time."
            )}
          </p>
          <Button
            size="sm"
            onClick={() => cast(draft, `Aura ${draft} submitted`)}
            disabled={rate.isPending || profile.myRating?.value === draft}
          >
            {rate.isPending && <Spinner />} {profile.myRating ? "Update" : "Submit"} {draft}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-black tabular-nums">
          <span className="flex items-center gap-1">
            <Flame className="h-3.5 w-3.5" /> {profile.upCount.toLocaleString()} upvotes
          </span>
          <span className="flex items-center gap-1">
            {profile.downCount.toLocaleString()} downvotes <ThumbsDown className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="border-ink bg-aura-low flex h-3.5 overflow-hidden rounded-full border-2">
          <motion.div
            className="border-ink bg-aura-high h-full border-r-2"
            initial={false}
            animate={{ width: `${upPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <p className="text-muted flex items-center gap-1 text-[10px] font-semibold">
          <Info className="h-3 w-3" /> Aura = average of every 0–100 rating (🔥 = 100, 👎 = 0), boosts add weight.
        </p>
      </div>
    </div>
  );
}

/** Pay-per-click boost widget: up to 10 clicks per profile per day at $0.01 each, batched in real time. */
export function BoostWidget({ profile }: { profile: ProfileDetail }) {
  const { data: me } = useMe();
  const boost = useBoost(profile.id);
  const guard = useAuthGuard();
  const setCreditsOpen = useUi((s) => s.setCreditsOpen);
  const [pending, setPending] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(0);

  const used = (profile.myRating?.boostsToday ?? 0) + pending;
  const remaining = Math.max(0, BOOST_DAILY_CAP - used);
  const balance = (me?.creditBalance ?? 0) - pending * BOOST_COST_CENTS;
  const hasRating = Boolean(profile.myRating);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const flush = () => {
    const clicks = pendingRef.current;
    if (!clicks) return;
    boost.mutate(clicks, {
      onSuccess: (res) =>
        toast.success(`⚡ Boosted ×${clicks}`, {
          description: `Your rating now counts ×${res.myRating.weight}. Balance ${formatCents(res.creditBalance)}.`,
        }),
      onError: (e) => toast.error(errorMessage(e)),
      onSettled: () => {
        pendingRef.current = 0;
        setPending(0);
      },
    });
  };

  const click = () => {
    if (!guard(`Create an account to boost ${profile.displayName}.`)) return;
    if (!hasRating) return toast("Rate first — boosts amplify your rating.");
    if (remaining <= 0) return toast(`Daily cap reached — ${BOOST_DAILY_CAP} boosts per profile per 24h.`);
    if (balance < BOOST_COST_CENTS) {
      setCreditsOpen(true);
      return;
    }
    pendingRef.current += 1;
    setPending(pendingRef.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 650);
  };

  return (
    <div className="border-ink bg-aura-mid/60 shadow-hard space-y-3 rounded-2xl border-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-black tracking-tight uppercase">
            <Zap className="fill-ink h-4 w-4" /> Boost
            <span className="border-ink rounded-md border-2 bg-white px-1.5 text-[10px] normal-case">
              {formatCents(BOOST_COST_CENTS)}/click
            </span>
          </h2>
          <p className="text-ink-2 text-[11px] font-semibold">
            Each click adds +1 weight to your rating of {profile.displayName.split(" ")[0]}.
          </p>
        </div>
        {me && (
          <button
            onClick={() => setCreditsOpen(true)}
            className="border-ink shadow-hard-xs shrink-0 rounded-lg border-2 bg-white px-2 py-1 text-right"
          >
            <span className="text-muted block text-[9px] font-extrabold uppercase">Balance</span>
            <span className="block text-sm font-black tabular-nums">{formatCents(Math.max(0, balance))}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-1" aria-label={`${used} of ${BOOST_DAILY_CAP} daily boosts used`}>
        {Array.from({ length: BOOST_DAILY_CAP }, (_, i) => (
          <motion.span
            key={i}
            className="border-ink h-4 flex-1 rounded-md border-2"
            initial={false}
            animate={{
              backgroundColor: i < used ? "#0A0A0C" : "#FFFFFF",
              scale: i === used - 1 && pending ? [1, 1.25, 1] : 1,
            }}
            transition={{ duration: 0.25 }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="primary" size="lg" className="flex-1" onClick={click} disabled={boost.isPending && !pending}>
          <Zap className="fill-aura-mid h-5 w-5" strokeWidth={2} />
          {pending ? `Boosting ×${pending}…` : "Boost +1"}
        </Button>
        <span className="w-16 text-center text-[11px] leading-tight font-extrabold">
          <AnimatePresence mode="popLayout">
            <motion.span
              key={remaining}
              initial={{ y: -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="block text-lg font-black tabular-nums"
            >
              {remaining}
            </motion.span>
          </AnimatePresence>
          left today
        </span>
      </div>
      {!hasRating && me && <p className="text-[11px] font-bold">Cast your Aura rating above to unlock boosts.</p>}
      {me && (me.creditBalance ?? 0) < 10 && (
        <button
          onClick={() => setCreditsOpen(true)}
          className={cn("text-[11px] font-extrabold underline underline-offset-2")}
        >
          Running low — top up boost credit
        </button>
      )}
    </div>
  );
}
