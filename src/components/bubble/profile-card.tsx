"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AuraFrame } from "@/components/aura/aura";
import { Photo } from "@/components/aura/photo";
import type { ProfileCard as Card } from "@/types/api";

/** Square card: photo, name and a frame in the score colour — every metric lives on the profile page. */
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
        aria-label={p.displayName}
      >
        <AuraFrame score={p.auraScore} thickness="md">
          <div className="border-ink bg-surface-2 [container-type:inline-size] relative aspect-square w-full overflow-hidden rounded-xl border-2">
            <Photo
              src={p.photoUrl}
              alt={p.displayName}
              eager={priority}
              className="transition-transform duration-500 group-hover:scale-[1.04]"
            />

            {rank !== undefined && (
              <span className="absolute top-2 left-2 grid h-7 min-w-7 place-items-center rounded-full bg-black/75 px-1.5 text-xs font-black text-white tabular-nums backdrop-blur-md">
                #{rank}
              </span>
            )}
            <div className="absolute inset-x-1.5 bottom-1.5 rounded-xl border border-white/20 bg-black/70 px-2 py-1.5 text-white backdrop-blur-md sm:inset-x-2 sm:bottom-2">
              <p className="truncate text-xs leading-tight font-black sm:text-sm">{p.displayName}</p>
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
      <div className="pc-skeleton aspect-square w-full rounded-xl" />
    </div>
  );
}
