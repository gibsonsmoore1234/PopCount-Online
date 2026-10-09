"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { apiFetch, errorMessage } from "@/lib/api/client";
import { setBalance } from "@/hooks/api";
import { formatCents } from "@/lib/aura";
import { Spinner } from "@/components/ui/misc";

export function CheckoutSuccess() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const [state, setState] = useState<{ balance?: number; error?: string }>({});
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const sessionId = params.get("session_id") ?? "";
    apiFetch<{ creditBalance: number }>("/api/credits/confirm", { method: "POST", json: { sessionId } })
      .then((r) => {
        setBalance(qc, r.creditBalance);
        setState({ balance: r.creditBalance });
      })
      .catch((e) => setState({ error: errorMessage(e) }));
  }, [params, qc]);

  return (
    <div className="pc-dotgrid grid min-h-[calc(100dvh-4rem)] place-items-center px-4">
      <div className="border-ink shadow-hard-lg max-w-sm rounded-2xl border-2 bg-white p-8 text-center">
        <div className="border-ink bg-aura-high shadow-hard-sm mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl border-2">
          {state.balance === undefined && !state.error ? (
            <Spinner className="h-6 w-6" />
          ) : (
            <Zap className="fill-ink h-6 w-6" />
          )}
        </div>
        <h1 className="text-2xl font-black tracking-tight uppercase">
          {state.error ? "Payment pending" : "Credits added"}
        </h1>
        <p className="text-muted mt-1 text-sm font-semibold">
          {state.error
            ? `${state.error} If you were charged, credits appear as soon as Stripe confirms the payment.`
            : state.balance !== undefined
              ? `Your balance is now ${formatCents(state.balance)}.`
              : "Confirming your purchase…"}
        </p>
        <Link
          href="/"
          className="border-ink bg-ink shadow-hard-sm mt-5 inline-flex h-10 items-center rounded-xl border-2 px-4 text-sm font-extrabold text-white"
        >
          Back to the map
        </Link>
      </div>
    </div>
  );
}
