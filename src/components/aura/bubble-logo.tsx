"use client";

import { useState } from "react";
import { auraColor } from "@/lib/aura";
import { cn, monogram } from "@/lib/utils";

/** A bubble's custom logo, or a monogram tile tinted with the bubble's average Aura. */
export function BubbleLogo({
  name,
  logoUrl,
  avgAura,
  colors,
  size = 40,
  className,
}: {
  name: string;
  logoUrl: string | null;
  colors?: [string, string] | null;
  avgAura: number | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        style={style}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("border-ink shrink-0 rounded-xl border-2 bg-white object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        ...style,
        background: colors ? colors[0] : auraColor(avgAura),
        ...(colors && { color: colors[1] }),
        fontSize: Math.max(10, size * (monogram(name).length > 2 ? 0.27 : 0.36)),
      }}
      className={cn(
        "border-ink text-ink grid shrink-0 place-items-center rounded-xl border-2 font-black tracking-tight",
        className,
      )}
    >
      {monogram(name)}
    </span>
  );
}
