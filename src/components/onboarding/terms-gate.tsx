"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useTerms } from "@/stores/terms-store";
import { useAcceptTerms, useMe } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";

const OPEN_PATHS = ["/terms", "/guidelines", "/privacy"];

/**
 * One-screen entry gate: a short Section 230 notice plus an 18+ / terms checkbox.
 */
export function TermsGate({ initiallyAccepted }: { initiallyAccepted: boolean }) {
  const { accepted, accept } = useTerms();
  const { data: me } = useMe();
  const acceptOnAccount = useAcceptTerms();
  const pathname = usePathname();
  const [agreed, setAgreed] = useState(false);

  // A signed-in account that never accepted (e.g. created before a terms update) must accept too.
  const needsAccount = Boolean(me && !me.termsAccepted);
  const isAccepted = (accepted || initiallyAccepted) && !needsAccount;
  const open = !isAccepted && !OPEN_PATHS.some((p) => pathname.startsWith(p));

  const enter = () => {
    accept();
    if (me && !me.termsAccepted) acceptOnAccount.mutate();
  };

  return (
    <D.Root open={open}>
      <D.Portal>
        <D.Overlay className="bg-ink/80 fixed inset-0 z-[2000] backdrop-blur-md" />
        <D.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="border-ink shadow-hard-lg data-[state=open]:animate-pop-in fixed top-1/2 left-1/2 z-[2001] w-[calc(100vw-1.5rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border-[3px] bg-white p-5 focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <span
              className="grid h-8 w-8 place-items-center rounded-lg text-sm font-black"
              style={{ background: "#000", color: "#fff", border: "2.5px solid #22c55e" }}
            >
              P
            </span>
            <D.Title className="text-base font-black tracking-tight">
              PopCount <span style={{ color: "#ef4444" }}>Online</span>
            </D.Title>
          </div>
          <D.Description className="text-muted text-xs leading-relaxed font-semibold">
            Everything here is posted by users. Under Section 230 (47 U.S.C. § 230), PopCount is not the publisher of
            user content — you are responsible for what you post.
          </D.Description>
          <Checkbox id="tos" checked={agreed} onChange={setAgreed}>
            I&apos;m 18+ and agree to the{" "}
            <Link href="/terms" target="_blank" className="underline decoration-2 underline-offset-2">
              Terms
            </Link>{" "}
            &amp;{" "}
            <Link href="/guidelines" target="_blank" className="underline decoration-2 underline-offset-2">
              Guidelines
            </Link>
            .
          </Checkbox>
          <Button size="md" className="w-full" onClick={enter} disabled={!agreed}>
            Enter <ArrowRight className="h-4 w-4" strokeWidth={3} />
          </Button>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
