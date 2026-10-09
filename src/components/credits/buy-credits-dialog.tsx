"use client";

import { Zap, Check, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { useCheckout, useMe } from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { BOOST_COST_CENTS, BOOST_DAILY_CAP, CREDIT_PACKS, formatCents } from "@/lib/aura";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function BuyCreditsDialog() {
  const open = useUi((s) => s.creditsOpen);
  const setOpen = useUi((s) => s.setCreditsOpen);
  const { data: me } = useMe();
  const checkout = useCheckout();

  const buy = (packId: string) =>
    checkout.mutate(packId, {
      onSuccess: (res) => {
        if (res.mode === "demo") {
          toast.success("Credits added", {
            description: `Demo mode — no card was charged. New balance ${formatCents(res.creditBalance ?? 0)}.`,
          });
          setOpen(false);
        }
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        title="Boost credit"
        description={`Each boost click costs ${formatCents(BOOST_COST_CENTS)} and adds +1 weight to your rating.`}
        size="md"
      >
        <div className="space-y-4 p-5">
          <div className="border-ink bg-aura-high shadow-hard-sm flex items-center justify-between rounded-xl border-2 px-4 py-3">
            <div>
              <p className="text-[10px] font-extrabold tracking-wider uppercase">Your balance</p>
              <p className="text-2xl font-black tabular-nums">{formatCents(me?.creditBalance ?? 0)}</p>
            </div>
            <div className="text-right text-xs font-extrabold">
              <Zap className="fill-ink ml-auto h-6 w-6" strokeWidth={2} />
              {(me?.creditBalance ?? 0).toLocaleString()} clicks
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {CREDIT_PACKS.map((p, i) => (
              <button
                key={p.id}
                disabled={checkout.isPending}
                onClick={() => buy(p.id)}
                className={cn(
                  "group border-ink shadow-hard-sm hover:shadow-hard relative flex flex-col items-start gap-1 rounded-xl border-2 bg-white p-3 text-left transition hover:-translate-y-0.5 disabled:opacity-60",
                  i === 1 && "bg-aura-mid",
                )}
              >
                {i === 1 && (
                  <span className="border-ink bg-ink absolute -top-2.5 right-2 rounded-full border-2 px-2 py-0.5 text-[9px] font-black text-white uppercase">
                    Popular
                  </span>
                )}
                <span className="text-muted text-[11px] font-extrabold tracking-wider uppercase">{p.label}</span>
                <span className="text-xl font-black tabular-nums">{formatCents(p.priceCents)}</span>
                <span className="text-xs font-bold">{p.blurb}</span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold underline-offset-2 group-hover:underline">
                  {checkout.isPending && checkout.variables === p.id ? (
                    <Spinner className="h-3 w-3" />
                  ) : (
                    <CreditCard className="h-3 w-3" />
                  )}
                  Buy
                </span>
              </button>
            ))}
          </div>

          <ul className="text-ink-2 space-y-1.5 text-xs font-semibold">
            <li className="flex gap-2">
              <Check className="h-4 w-4 shrink-0" strokeWidth={3} /> Boosts amplify the rating you already cast — up or
              down.
            </li>
            <li className="flex gap-2">
              <Check className="h-4 w-4 shrink-0" strokeWidth={3} /> Max {BOOST_DAILY_CAP} boost clicks per profile
              every 24 hours keeps rankings fair.
            </li>
            <li className="flex gap-2">
              <Check className="h-4 w-4 shrink-0" strokeWidth={3} /> Secure checkout by Stripe. Credits have no cash
              value.
            </li>
          </ul>
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setOpen(false)}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
