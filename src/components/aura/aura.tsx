import type { ReactNode } from "react";
import { AURA_COLORS, auraTier, formatAura, tierLabel, type AuraTier } from "@/lib/aura";
import { cn } from "@/lib/utils";

/** Tenths-precision score pill, filled with the score's tier colour. */
export function AuraBadge({
  score,
  size = "md",
  className,
  suffix,
}: {
  score: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  suffix?: string;
}) {
  const tier = auraTier(score);
  return (
    <span
      className={cn(
        "border-ink text-ink inline-flex items-center rounded-full border-2 font-black tabular-nums",
        {
          sm: "px-1.5 py-0 text-[10px]",
          md: "px-2 py-0.5 text-[11px]",
          lg: "px-3 py-1 text-sm",
          xl: "shadow-hard-sm px-4 py-1.5 text-xl",
        }[size],
        className,
      )}
      style={{ background: AURA_COLORS[tier] }}
      title={tierLabel(tier)}
    >
      {score === null ? "NEW" : formatAura(score)}
      {suffix && <span className="ml-1 font-extrabold opacity-70">{suffix}</span>}
    </span>
  );
}

/**
 * Score frame: the card is framed in the profile's Aura colour (green / yellow / coral),
 * with the photo inset so the frame reads as a coloured border around ~90% of the card.
 */
export function AuraFrame({
  score,
  children,
  className,
  thickness = "md",
}: {
  score: number | null;
  children: ReactNode;
  className?: string;
  thickness?: "sm" | "md" | "lg";
}) {
  const tier = auraTier(score);
  return (
    <div
      className={cn(
        "border-ink rounded-[var(--radius-card)] border-2",
        { sm: "p-1", md: "p-1.5", lg: "p-2.5" }[thickness],
        className,
      )}
      style={{ background: `color-mix(in srgb, ${AURA_COLORS[tier]} 90%, white)` }}
      data-tier={tier}
    >
      {children}
    </div>
  );
}

export function AuraDot({ tier, className }: { tier: AuraTier; className?: string }) {
  return (
    <span
      className={cn("border-ink inline-block h-2.5 w-2.5 rounded-full border", className)}
      style={{ background: AURA_COLORS[tier] }}
    />
  );
}

export function AuraLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-extrabold tracking-wide uppercase",
        className,
      )}
    >
      <span className="flex items-center gap-1">
        <AuraDot tier="high" /> 67–100
      </span>
      <span className="flex items-center gap-1">
        <AuraDot tier="mid" /> 34–66
      </span>
      <span className="flex items-center gap-1">
        <AuraDot tier="low" /> 0–33
      </span>
    </div>
  );
}
