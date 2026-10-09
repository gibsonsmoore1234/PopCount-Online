import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin", className)} strokeWidth={3} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("pc-skeleton rounded-xl", className)} aria-hidden />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("border-ink shadow-hard rounded-[var(--radius-card)] border-2 bg-white", className)}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-ink bg-surface flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {icon && (
        <div className="border-ink shadow-hard-sm mb-1 grid h-12 w-12 place-items-center rounded-2xl border-2 bg-white">
          {icon}
        </div>
      )}
      <p className="text-sm font-black tracking-tight uppercase">{title}</p>
      {body && <p className="text-muted max-w-sm text-xs font-semibold">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="border-ink bg-aura-low/15 flex flex-col items-center gap-2 rounded-2xl border-2 px-6 py-8 text-center"
    >
      <p className="text-sm font-black uppercase">Couldn&apos;t load this</p>
      <p className="text-ink-2 text-xs font-semibold">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="border-ink shadow-hard-sm mt-1 rounded-lg border-2 bg-white px-3 py-1 text-xs font-extrabold"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="border-ink shadow-hard-sm min-w-0 rounded-xl border-2 bg-white px-3 py-2">
      <div className="text-muted truncate text-[10px] font-extrabold tracking-wider uppercase">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5 truncate text-lg leading-tight font-black tabular-nums">
        {accent && (
          <span className="border-ink h-2.5 w-2.5 shrink-0 rounded-full border" style={{ background: accent }} />
        )}
        {value}
      </div>
    </div>
  );
}
