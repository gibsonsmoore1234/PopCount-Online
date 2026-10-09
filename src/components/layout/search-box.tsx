"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, X, MapPin } from "lucide-react";
import { useSearch } from "@/hooks/api";
import { useDebounced } from "@/hooks/use-gate";
import { AuraBadge } from "@/components/aura/aura";
import { Avatar } from "@/components/aura/photo";
import { BubbleLogo } from "@/components/aura/bubble-logo";
import { Spinner } from "@/components/ui/misc";
import { cn, plural } from "@/lib/utils";

type Item = { key: string; href: string };

/** Global search across people and bubbles, with national rank and keyboard navigation. */
export function SearchBox({
  className,
  autoFocus,
  onNavigate,
}: {
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(q.trim(), 220);
  const { data, isFetching } = useSearch(debounced);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const items: Item[] = useMemo(
    () => [
      ...(data?.profiles ?? []).map((p) => ({ key: `p-${p.id}`, href: `/p/${p.id}` })),
      ...(data?.bubbles ?? []).map((b) => ({ key: `b-${b.id}`, href: `/b/${b.slug}` })),
    ],
    [data],
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    onNavigate?.();
    router.push(href);
  };

  const showPanel = open && debounced.length >= 2;
  const empty = data && data.profiles.length === 0 && data.bubbles.length === 0;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <div className="border-ink focus-within:shadow-hard-sm flex h-10 items-center gap-2 rounded-xl border-2 bg-white px-3 transition-shadow">
        <Search className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />
        <input
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && items[active]) {
              e.preventDefault();
              go(items[active].href);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search people and bubbles…"
          aria-label="Search people and bubbles"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          className="placeholder:text-muted h-full min-w-0 flex-1 bg-transparent text-sm font-semibold focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {isFetching && debounced.length >= 2 ? (
          <Spinner className="text-muted h-3.5 w-3.5" />
        ) : q ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQ("")}
            className="hover:bg-surface-2 rounded p-0.5"
          >
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        ) : null}
      </div>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="border-ink shadow-hard animate-slide-up pc-scroll absolute top-12 right-0 left-0 z-[1200] max-h-[70vh] overflow-y-auto rounded-2xl border-2 bg-white p-2"
        >
          {empty && (
            <p className="text-muted px-3 py-6 text-center text-xs font-bold">
              No people or bubbles match “{debounced}”.
            </p>
          )}

          {data && data.profiles.length > 0 && (
            <div className="mb-1">
              <p className="text-muted px-2 pt-1 pb-1 text-[10px] font-extrabold tracking-wider uppercase">People</p>
              {data.profiles.map((p, i) => (
                <button
                  key={p.id}
                  role="option"
                  aria-selected={active === i}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(`/p/${p.id}`)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left",
                    active === i && "bg-surface-2",
                  )}
                >
                  <Avatar src={p.photoUrl} name={p.displayName} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{p.displayName}</span>
                    <span className="text-muted block truncate text-[11px] font-semibold">
                      @{p.handle} · {p.bubble.name}
                    </span>
                  </span>
                  {p.rank > 0 && <span className="text-muted text-[11px] font-black">#{p.rank}</span>}
                  <AuraBadge score={p.auraScore} size="sm" />
                </button>
              ))}
            </div>
          )}

          {data && data.bubbles.length > 0 && (
            <div>
              <p className="text-muted px-2 pt-1 pb-1 text-[10px] font-extrabold tracking-wider uppercase">Bubbles</p>
              {data.bubbles.map((b, j) => {
                const i = data.profiles.length + j;
                return (
                  <button
                    key={b.id}
                    role="option"
                    aria-selected={active === i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(`/b/${b.slug}`)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left",
                      active === i && "bg-surface-2",
                    )}
                  >
                    <BubbleLogo name={b.name} logoUrl={b.logoUrl} avgAura={b.avgAura} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">{b.name}</span>
                      <span className="text-muted flex items-center gap-1 truncate text-[11px] font-semibold">
                        <MapPin className="h-3 w-3" strokeWidth={2.5} />
                        {b.countyName}, {b.stateName} · {plural(b.profileCount, "person", "people")}
                      </span>
                    </span>
                    <AuraBadge score={b.avgAura} size="sm" suffix="avg" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
