"use client";

import { cn } from "@/lib/utils";

/** Horizontal pill toggle group (sort/filter toolbars). */
export function Pills<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; icon?: React.ReactNode }[];
  className?: string;
  size?: "sm" | "md";
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("pc-no-scrollbar flex gap-2 overflow-x-auto pb-1", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "border-ink inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 font-extrabold transition-all",
              size === "sm" ? "h-7 px-3 text-[11px]" : "h-9 px-4 text-xs",
              active ? "bg-ink shadow-hard-sm text-white" : "text-ink hover:bg-surface-2 bg-white",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
