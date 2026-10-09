"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, AnimatePresence } from "motion/react";
import { Zap } from "lucide-react";
import { toast } from "sonner";
import { useBoost, useMe, useRate } from "@/hooks/api";
import { useAuthGuard } from "@/hooks/use-gate";
import { useUi } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { BOOST_COST_CENTS, BOOST_DAILY_CAP, formatCents } from "@/lib/aura";
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
  // Typed 0–100 rating. Empty until the viewer types; prefilled with their saved rating.
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (profile.myRating ? String(profile.myRating.value) : "");
  const parsed = /^\d{1,3}$/.test(shown) ? Number(shown) : NaN;
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 100;
  const draft = valid ? parsed : 0;
  const setDraft = (v: null) => setText(v);

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

  return (
    <div className="border-ink shadow-hard rounded-2xl border-2 bg-white p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          value={shown}
          onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 3))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid && profile.myRating?.value !== draft) cast(draft, `Rated ${draft}`);
          }}
          placeholder="Rate 0–100"
          aria-label="Your rating from 0 to 100"
          aria-invalid={shown !== "" && !valid}
          className="border-ink aria-[invalid=true]:border-aura-low h-11 min-w-0 flex-1 rounded-xl border-2 bg-white px-3 text-center text-lg font-black tabular-nums placeholder:text-sm placeholder:font-bold focus:outline-none"
        />
        <Button
          size="md"
          className="h-11"
          onClick={() => cast(draft, `Rated ${draft}`)}
          disabled={rate.isPending || !valid || profile.myRating?.value === draft}
        >
          {rate.isPending && <Spinner />} {profile.myRating ? "Update" : "Rate"}
        </Button>
      </div>
      {shown !== "" && !valid ? (
        <p className="text-aura-low mt-1.5 text-xs font-bold">Enter a whole number from 0 to 100.</p>
      ) : (
        profile.myRating && (
          <p className="text-muted mt-1.5 text-[11px] font-semibold">
            Your rating: <b className="text-ink">{profile.myRating.value}</b>
          </p>
        )
      )}
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
              backgroundColor: i < used ? "#22C55E" : "#1B1B1F",
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
      {!hasRating && me && <p className="text-[11px] font-bold">Rate them above to unlock boosts.</p>}
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
