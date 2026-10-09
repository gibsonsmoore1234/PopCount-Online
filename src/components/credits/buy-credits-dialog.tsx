"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Gift } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { useClaimAd, useMe, useStartAd, type AdDto } from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { errorMessage } from "@/lib/api/client";

/** "Get more clicks": watch a 10-second ad → +10 boost clicks. No payments anywhere. */
export function BuyCreditsDialog() {
  const open = useUi((s) => s.creditsOpen);
  const setOpen = useUi((s) => s.setCreditsOpen);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title="Get more clicks" description="Watch a short ad to earn free boost clicks." size="md">
        {open && <AdPlayer onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AdPlayer({ onDone }: { onDone: () => void }) {
  const { data: me } = useMe();
  const start = useStartAd();
  const claim = useClaimAd();
  const [view, setView] = useState<{ viewId: string; ad: AdDto } | null>(null);
  const [left, setLeft] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  const watch = () =>
    start.mutate(undefined, {
      onSuccess: (v) => {
        setView(v);
        setLeft(v.ad.durationSeconds);
        if (timer.current) clearInterval(timer.current);
        timer.current = setInterval(() => {
          setLeft((s) => {
            if (s <= 1 && timer.current) clearInterval(timer.current);
            return Math.max(0, s - 1);
          });
        }, 1000);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  const collect = () =>
    view &&
    claim.mutate(view.viewId, {
      onSuccess: (r) => {
        toast.success(`+${r.granted} clicks!`, { description: `You now have ${r.creditBalance} clicks.` });
        setView(null);
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  const balance = me?.creditBalance ?? 0;

  return (
    <div className="space-y-4 p-5">
      <div className="border-ink bg-aura-high flex items-center justify-between rounded-xl border-2 px-4 py-3">
        <div>
          <p className="text-[10px] font-extrabold tracking-wider uppercase">Your clicks</p>
          <p className="text-2xl font-black tabular-nums">{balance.toLocaleString()}</p>
        </div>
      </div>

      {view ? (
        <div className="space-y-3">
          <div className="border-ink relative aspect-video overflow-hidden rounded-xl border-2 bg-black">
            {view.ad.mediaType === "video" ? (
              <video src={view.ad.mediaUrl} autoPlay muted playsInline loop className="h-full w-full object-contain" />
            ) : (
              <img src={view.ad.mediaUrl} alt={view.ad.title} className="h-full w-full object-contain" />
            )}
            <span className="absolute top-2 left-2 rounded-full bg-black/75 px-2 py-0.5 text-[10px] font-black text-white uppercase">
              Ad{view.ad.advertiser ? ` · ${view.ad.advertiser}` : ""}
            </span>
            <span className="absolute top-2 right-2 grid h-8 min-w-8 place-items-center rounded-full bg-black/75 px-2 text-sm font-black text-white tabular-nums">
              {left > 0 ? left : "✓"}
            </span>
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-white/20">
              <div
                className="bg-aura-high h-full transition-[width] duration-1000 ease-linear"
                style={{ width: `${100 - (left / view.ad.durationSeconds) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-center text-sm font-bold">{view.ad.title}</p>
          {view.ad.clickUrl && (
            <a
              href={view.ad.clickUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="block text-center text-xs font-bold underline"
            >
              Learn more
            </a>
          )}
          <Button className="w-full" size="lg" disabled={left > 0 || claim.isPending} onClick={collect}>
            {claim.isPending ? <Spinner /> : <Gift className="h-5 w-5" />}
            {left > 0 ? `Watch ${left}s more…` : `Collect +${view.ad.rewardClicks} clicks`}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button className="w-full" size="lg" onClick={watch} disabled={start.isPending}>
            {start.isPending ? <Spinner /> : <Play className="h-5 w-5" />} Watch a 10-second ad · +10 clicks
          </Button>
          <p className="text-muted text-center text-xs font-semibold">
            Clicks boost your ratings. Free — no payment, ever. Up to 30 ads a day.
          </p>
          <Button variant="ghost" size="sm" className="w-full" onClick={onDone}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}
