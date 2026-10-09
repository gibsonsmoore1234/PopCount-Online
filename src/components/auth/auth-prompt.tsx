"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUi } from "@/stores/ui-store";

export function AuthPrompt() {
  const reason = useUi((s) => s.authPrompt);
  const close = useUi((s) => s.closeAuthPrompt);
  const pathname = usePathname();
  const next = encodeURIComponent(pathname);

  return (
    <Dialog open={Boolean(reason)} onOpenChange={(o) => !o && close()}>
      <DialogContent title="Join the contest" size="sm">
        <div className="space-y-4 p-5">
          <div className="border-ink bg-aura-high/40 flex items-start gap-3 rounded-xl border-2 p-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.5} />
            <p className="text-sm leading-snug font-bold">{reason}</p>
          </div>
          <p className="text-muted text-xs font-semibold">
            Accounts get <b className="text-ink">$2.50 of free boost credit</b>. Browsing stays free and open — an
            account is only needed to vote, comment or post.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" onClick={close}>
              <Link href={`/login?next=${next}`}>Log in</Link>
            </Button>
            <Button asChild onClick={close}>
              <Link href={`/signup?next=${next}`}>Sign up free</Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
