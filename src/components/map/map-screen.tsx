"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MapPinPlus, X, Crosshair, Users, Vote, Globe2 } from "lucide-react";
import { useBubbles, useMe } from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/aura";
import type { BubbleSummary } from "@/types/api";
import { CreateBubbleDialog } from "./create-bubble-dialog";
import { cn } from "@/lib/utils";

const CampusMap = dynamic(() => import("./campus-map"), {
  ssr: false,
  loading: () => (
    <div className="pc-dotgrid bg-ocean grid h-full w-full place-items-center">
      <span className="border-ink shadow-hard-sm rounded-xl border-2 bg-white px-3 py-1.5 text-xs font-extrabold">
        Loading map…
      </span>
    </div>
  ),
});

/** Layer 1 — the interactive Snap-Map-style campus map. */
export function MapScreen({ initialBubbles }: { initialBubbles: BubbleSummary[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: bubbles = initialBubbles } = useBubbles(initialBubbles);
  const { data: me } = useMe();
  const mapView = useUi((s) => s.mapView);
  const setMapView = useUi((s) => s.setMapView);
  const openProfileForm = useUi((s) => s.openProfileForm);
  const promptAuth = useUi((s) => s.promptAuth);
  const [pinning, setPinning] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [resetNonce, setResetNonce] = useState(0);

  // Deep links: /?create=1 opens the profile form.
  useEffect(() => {
    if (params.get("create") === "1") {
      if (me) openProfileForm();
      router.replace("/", { scroll: false });
    }
  }, [params, me, openProfileForm, router]);

  useEffect(() => {
    if (!pinning) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPinning(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinning]);

  const onOpenBubble = useCallback(
    (slug: string) => {
      if (!pinning) router.push(`/b/${slug}`);
    },
    [router, pinning],
  );

  const startPinning = () => {
    if (!me) return promptAuth("Create an account to drop a new bubble.");
    setPinning((p) => !p);
  };

  const totals = bubbles.reduce(
    (acc, b) => ({
      members: acc.members + b.memberCount,
      votes: acc.votes + b.totalVotes,
      profiles: acc.profiles + b.profileCount,
    }),
    { members: 0, votes: 0, profiles: 0 },
  );

  return (
    <section
      aria-label="Interactive map"
      className={cn(
        "relative h-[calc(100dvh-8rem)] w-full overflow-hidden md:h-[calc(100dvh-4rem)]",
        pinning && "pc-map-pinning",
      )}
    >
      <CampusMap
        bubbles={bubbles}
        onOpenBubble={onOpenBubble}
        pinning={pinning}
        pendingPin={pin}
        onPick={(lat, lng) => {
          setPin({ lat, lng });
          setPinning(false);
        }}
        initialView={mapView}
        onViewChange={(center, zoom) => setMapView({ center, zoom })}
        resetNonce={resetNonce}
      />

      {/* Info card */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] flex items-start justify-between gap-2">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-ink shadow-hard pointer-events-auto max-w-[min(22rem,calc(100vw-9rem))] rounded-2xl border-2 bg-white/95 p-3 backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <span className="animate-pulse-ring bg-aura-high h-2.5 w-2.5 rounded-full" />
            <h1 className="text-xs font-black tracking-tight uppercase">Interactive Map</h1>
          </div>
          <p className="text-ink-2 mt-1 hidden text-[11px] leading-snug font-semibold sm:block">
            Tap any bubble to open its feed. Bubble size = people · ring colour = average rating.
          </p>
        </motion.div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <Button
            size="sm"
            variant={pinning ? "boost" : "secondary"}
            onClick={startPinning}
            className="shadow-hard"
            aria-pressed={pinning}
          >
            {pinning ? <X className="h-4 w-4" strokeWidth={3} /> : <MapPinPlus className="h-4 w-4" strokeWidth={2.5} />}
            <span>{pinning ? "Cancel" : "Add Bubble"}</span>
          </Button>
          <Button
            size="icon-sm"
            variant="secondary"
            className="shadow-hard"
            aria-label="Reset view to the whole U.S."
            onClick={() => setResetNonce(Date.now())}
          >
            <Globe2 className="h-4 w-4" strokeWidth={2.5} />
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {pinning && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="border-ink bg-aura-mid shadow-hard absolute bottom-20 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-xs font-extrabold"
          >
            <Crosshair className="h-4 w-4" strokeWidth={2.5} />
            Click anywhere on the map to pin a new bubble · Esc to cancel
          </motion.div>
        )}
      </AnimatePresence>

      {/* National totals */}
      <div className="absolute bottom-3 left-3 z-[500] flex flex-wrap gap-1.5 text-[11px] font-extrabold">
        <span className="border-ink shadow-hard-sm flex items-center gap-1 rounded-xl border-2 bg-white px-2 py-1">
          <Globe2 className="h-3.5 w-3.5" /> {bubbles.length} bubbles
        </span>
        <span className="border-ink shadow-hard-sm flex items-center gap-1 rounded-xl border-2 bg-white px-2 py-1">
          <Users className="h-3.5 w-3.5" /> {formatCount(totals.profiles)} people
        </span>
        <span className="border-ink shadow-hard-sm hidden items-center gap-1 rounded-xl border-2 bg-white px-2 py-1 sm:flex">
          <Vote className="h-3.5 w-3.5" /> {formatCount(totals.votes)} votes
        </span>
      </div>

      <CreateBubbleDialog pin={pin} onClose={() => setPin(null)} />
    </section>
  );
}
