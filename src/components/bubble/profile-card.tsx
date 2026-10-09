"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { MessageCircle, Vote } from "lucide-react";
import { AuraBadge, AuraFrame } from "@/components/aura/aura";
import { Photo } from "@/components/aura/photo";
import { formatCount } from "@/lib/aura";
import { genderLabel } from "@/lib/utils";
import type { ProfileCard as Card } from "@/types/api";

/** Strict 2:3 portrait card framed in the profile's Aura colour. */
export function ProfileCard({ p, rank, priority }: { p: Card; rank?: number; priority?: boolean }) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-auto"
    >
      <Link
        href={`/p/${p.id}`}
        className="group shadow-hard hover:shadow-hard-lg block rounded-[var(--radius-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 focus-visible:-translate-y-1"
        aria-label={`${p.displayName}, Aura ${p.auraScore ?? "unrated"}`}
      >
        <AuraFrame score={p.auraScore} thickness="md">
          <div className="border-ink bg-surface-2 [container-type:inline-size] relative aspect-[2/3] w-full overflow-hidden rounded-xl border-2">
            <Photo
              src={p.photoUrl}
              alt={p.displayName}
              eager={priority}
              className="transition-transform duration-500 group-hover:scale-[1.04]"
            />

            <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1">
              <span className="border-ink rounded-full border-2 bg-white px-1.5 py-0.5 text-[10px] leading-none font-black uppercase">
                {rank ? `#${rank}` : genderLabel(p.gender, true)}
              </span>
              <AuraBadge score={p.auraScore} size="md" className="shadow-hard-xs" />
            </div>

            <div className="bg-ink/80 absolute inset-x-1.5 bottom-1.5 rounded-xl border border-white/20 p-2 text-white backdrop-blur-md sm:inset-x-2 sm:bottom-2">
              <p className="truncate text-xs leading-tight font-black sm:text-sm">{p.displayName}</p>
              <p className="truncate text-[10px] font-semibold text-white/70 sm:text-[11px]">
                {p.affiliation ?? genderLabel(p.gender)}
              </p>
              <div className="mt-1 flex items-center gap-2.5 text-[10px] font-extrabold text-white/90 tabular-nums">
                <span className="flex items-center gap-1" title="Total votes">
                  <Vote className="h-3 w-3" strokeWidth={2.5} /> {formatCount(p.voteCount)}
                </span>
                <span className="flex items-center gap-1" title="Comments">
                  <MessageCircle className="h-3 w-3" strokeWidth={2.5} /> {formatCount(p.commentCount)}
                </span>
              </div>
            </div>
          </div>
        </AuraFrame>
      </Link>
    </motion.div>
  );
}

export function ProfileCardSkeleton() {
  return (
    <div className="border-line rounded-[var(--radius-card)] border-2 p-1.5">
      <div className="pc-skeleton aspect-[2/3] w-full rounded-xl" />
    </div>
  );
}
