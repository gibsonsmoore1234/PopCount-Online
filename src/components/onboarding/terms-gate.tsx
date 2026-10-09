"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { HeartHandshake, Scale, BadgeCheck, ArrowLeft, ArrowRight } from "lucide-react";
import { Dialog as D } from "radix-ui";
import { useTerms } from "@/stores/terms-store";
import { useAcceptTerms, useMe } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Guidelines", icon: HeartHandshake },
  { id: 2, label: "Liability", icon: Scale },
  { id: 3, label: "Age check", icon: BadgeCheck },
] as const;

const OPEN_PATHS = ["/terms", "/guidelines", "/privacy"];

/**
 * Mandatory 3-part onboarding: Community Guidelines → Liability Waiver → Age Verification.
 * Nothing (including the map) is usable until all three are accepted.
 */
export function TermsGate({ initiallyAccepted }: { initiallyAccepted: boolean }) {
  const { accepted, accept } = useTerms();
  const { data: me } = useMe();
  const acceptOnAccount = useAcceptTerms();
  const pathname = usePathname();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [adult, setAdult] = useState(false);
  const [tos, setTos] = useState(false);

  // A signed-in account that never accepted (e.g. created before a terms update) must accept too.
  const needsAccount = Boolean(me && !me.termsAccepted);
  const isAccepted = (accepted || initiallyAccepted) && !needsAccount;
  const open = !isAccepted && !OPEN_PATHS.some((p) => pathname.startsWith(p));

  const next = () => {
    if (step < 3) {
      setDir(1);
      setStep(step + 1);
      return;
    }
    accept();
    if (me && !me.termsAccepted) acceptOnAccount.mutate();
  };
  const back = () => {
    setDir(-1);
    setStep(Math.max(1, step - 1));
  };

  return (
    <D.Root open={open}>
      <D.Portal>
        <D.Overlay className="bg-ink/80 fixed inset-0 z-[2000] backdrop-blur-md" />
        <D.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="border-ink shadow-hard-lg data-[state=open]:animate-pop-in fixed top-1/2 left-1/2 z-[2001] flex max-h-[94dvh] w-[calc(100vw-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[3px] bg-white focus:outline-none"
        >
          <div className="border-ink bg-surface border-b-2 px-5 pt-5 pb-4">
            <div className="flex items-center gap-2">
              <span className="border-ink bg-ink grid h-8 w-8 place-items-center rounded-lg border-2 text-sm font-black text-white">
                P
              </span>
              <D.Title className="text-base font-black tracking-tight uppercase">Welcome to Pop Count</D.Title>
            </div>
            <D.Description className="text-muted mt-1 text-xs font-semibold">
              Three quick agreements before the map unlocks. Step {step} of 3.
            </D.Description>

            <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Progress">
              {STEPS.map((s) => {
                const done = s.id < step;
                const current = s.id === step;
                return (
                  <li key={s.id} className="space-y-1.5">
                    <div className="border-ink h-2 overflow-hidden rounded-full border-2 bg-white">
                      <motion.div
                        className="bg-ink h-full"
                        initial={false}
                        animate={{ width: done || current ? "100%" : "0%" }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1 text-[10px] font-extrabold tracking-wide uppercase",
                        current ? "text-ink" : "text-muted",
                      )}
                      aria-current={current ? "step" : undefined}
                    >
                      <s.icon className="h-3.5 w-3.5" strokeWidth={2.5} /> {s.label}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="pc-scroll relative min-h-[300px] flex-1 overflow-x-hidden overflow-y-auto px-5 py-5">
            <AnimatePresence mode="wait" custom={dir} initial={false}>
              <motion.div
                key={step}
                custom={dir}
                initial={{ opacity: 0, x: dir * 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: dir * -24 }}
                transition={{ duration: 0.18 }}
                className="space-y-3 text-sm"
              >
                {step === 1 && <StepGuidelines />}
                {step === 2 && <StepLiability />}
                {step === 3 && (
                  <>
                    <h3 className="text-lg font-black tracking-tight uppercase">3. Age & student verification</h3>
                    <p className="text-ink-2 leading-relaxed font-semibold">
                      Pop Count is strictly for adults. Profiles of anyone under 18 are removed immediately and the
                      account that posted them is banned.
                    </p>
                    <Checkbox id="age" checked={adult} onChange={setAdult}>
                      I confirm I am <b>18 years of age or older</b> and a current student or member of the community I
                      join.
                    </Checkbox>
                    <Checkbox id="tos" checked={tos} onChange={setTos}>
                      I agree to the{" "}
                      <Link href="/terms" target="_blank" className="underline decoration-2 underline-offset-2">
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link href="/guidelines" target="_blank" className="underline decoration-2 underline-offset-2">
                        Community Guidelines
                      </Link>
                      .
                    </Checkbox>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="border-ink flex items-center justify-between gap-3 border-t-2 px-5 py-3.5">
            <Button variant="secondary" size="sm" onClick={back} className={cn(step === 1 && "invisible")}>
              <ArrowLeft className="h-4 w-4" strokeWidth={3} /> Back
            </Button>
            <Button size="md" onClick={next} disabled={step === 3 && !(adult && tos)}>
              {step === 1 ? "I Agree & Continue" : step === 2 ? "I Agree — Next" : "Enter Pop Count"}
              <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </Button>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function StepGuidelines() {
  return (
    <>
      <h3 className="text-lg font-black tracking-tight uppercase">1. Community guidelines</h3>
      <p className="text-ink-2 leading-relaxed font-semibold">
        Pop Count is a game people <b>opt into</b>. Every profile is created by the person in it — you can only post
        yourself.
      </p>
      <ul className="space-y-2">
        {[
          ["No bullying or harassment", "Rate the vibe, never attack the person. Pile-ons and threats get you banned."],
          ["No hate speech", "Slurs and attacks based on race, religion, gender, sexuality or disability are removed."],
          ["No body shaming", "Comments about bodies, weight or appearance-based insults are not allowed."],
          ["No impersonation or doxxing", "Only post photos of yourself. Never share someone's private information."],
        ].map(([t, d]) => (
          <li key={t} className="border-ink bg-surface flex gap-3 rounded-xl border-2 p-3">
            <span className="border-ink bg-aura-high mt-0.5 h-3 w-3 shrink-0 rounded-full border-2" />
            <span>
              <b className="block text-[13px] font-extrabold">{t}</b>
              <span className="text-muted text-xs font-semibold">{d}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function StepLiability() {
  return (
    <>
      <h3 className="text-lg font-black tracking-tight uppercase">2. Liability & your content</h3>
      <p className="text-ink-2 leading-relaxed font-semibold">
        Pop Count hosts content created by its users. By continuing you agree that:
      </p>
      <ul className="text-ink-2 list-none space-y-2 text-[13px] font-semibold">
        <li className="border-ink rounded-xl border-2 p-3">
          You are <b>solely and legally responsible</b> for every photo you upload, comment you post and rating you
          cast.
        </li>
        <li className="border-ink rounded-xl border-2 p-3">
          You own (or have the rights to) everything you upload, and you grant Pop Count a licence to display it.
        </li>
        <li className="border-ink rounded-xl border-2 p-3">
          Scores are opinions aggregated from other users — not statements of fact by Pop Count. Clicks are free, earned
          by watching ads, and have no cash value.
        </li>
        <li className="border-ink bg-aura-mid/50 rounded-xl border-2 p-3">
          Anyone can report content. Moderators may hide or remove content and suspend accounts that break the rules.
        </li>
      </ul>
    </>
  );
}
