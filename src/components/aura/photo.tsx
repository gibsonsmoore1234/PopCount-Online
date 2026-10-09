"use client";

import { useState } from "react";
import { cn, initials } from "@/lib/utils";

/** Profile photo with a graceful monogram fallback when the source fails to load. */
export function Photo({
  src,
  alt,
  className,
  rounded = "rounded-none",
  eager,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  rounded?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "bg-surface-2 pc-dotgrid text-ink/70 grid h-full w-full place-items-center font-black",
          rounded,
          className,
        )}
      >
        <span className="text-[clamp(0.75rem,18cqw,4rem)]">{initials(alt) || "?"}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", rounded, className)}
    />
  );
}

export function Avatar({
  src,
  name,
  size = 32,
  className,
}: {
  src: string | null | undefined;
  name: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn("border-ink bg-surface-2 inline-block shrink-0 overflow-hidden rounded-full border-2", className)}
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          role="img"
          aria-label={name}
          className="bg-aura-mid text-ink grid h-full w-full place-items-center font-black"
          style={{ fontSize: Math.max(9, size * 0.38) }}
        >
          {initials(name.replace(/^@/, "").replace(/_/g, " ")) || "?"}
        </span>
      )}
    </span>
  );
}
