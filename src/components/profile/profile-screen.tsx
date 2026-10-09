"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Share2, Flag, MapPin, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useProfile } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { AuraFrame } from "@/components/aura/aura";
import { Photo } from "@/components/aura/photo";
import { AURA_COLORS, auraTier, formatCount } from "@/lib/aura";
import type { ProfileDetail } from "@/types/api";
import { AnimatedNumber, VoteConsole } from "./vote-console";
import { CommentsPanel } from "./comments-panel";
import { ReportDialog } from "./report-dialog";
import { AdminDeleteButton } from "@/components/admin/admin-delete-button";

/** Layer 3 — full-screen "Tea-app" style profile takeover. */
export function ProfileScreen({ initial }: { initial: ProfileDetail }) {
  const { data: profile = initial } = useProfile(initial.id, initial);
  const [reporting, setReporting] = useState(false);
  const tier = auraTier(profile.auraScore);
  const photos = profile.photos?.length ? profile.photos : [profile.photoUrl];
  const [shown, setShown] = useState(0);
  const current = photos[Math.min(shown, photos.length - 1)];

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${profile.displayName} on Pop Count`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="bg-surface pc-dotgrid min-h-[calc(100dvh-4rem)]">
      {/* Sticky profile bar */}
      <div className="border-ink sticky top-16 z-[400] border-b-2 bg-white backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2.5 sm:px-6">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/b/${profile.bubble.slug}`}>
              <ArrowLeft className="h-4 w-4" strokeWidth={3} /> <span className="hidden sm:inline">Back to Bubble</span>
              <span className="sm:hidden">Back</span>
            </Link>
          </Button>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-black tracking-tight uppercase">{profile.displayName}</p>
            <p className="text-muted truncate text-[11px] font-bold">{profile.bubble.name}</p>
          </div>
          <Button variant="secondary" size="icon-sm" aria-label="Share profile" onClick={share}>
            <Share2 className="h-4 w-4" strokeWidth={2.5} />
          </Button>
          {
            <Button variant="secondary" size="icon-sm" aria-label="Report profile" onClick={() => setReporting(true)}>
              <Flag className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          }
          <AdminDeleteButton
            kind="profile"
            id={profile.id}
            name={profile.displayName}
            backTo={`/b/${profile.bubble.slug}`}
          />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
        {profile.isHidden && (
          <div className="border-ink bg-aura-low/30 mb-4 flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-bold">
            <EyeOff className="h-4 w-4" /> This profile is hidden by moderators and isn&apos;t visible to others.
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-8">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-auto w-full max-w-[330px] space-y-3 sm:max-w-[440px] lg:sticky lg:top-36"
          >
            <AuraFrame score={profile.auraScore} thickness="lg" className="shadow-hard-lg">
              <div className="border-ink [container-type:inline-size] relative aspect-[2/3] w-full overflow-hidden rounded-xl border-2 bg-white">
                <Photo key={current} src={current} alt={profile.displayName} eager />
                {photos.length > 1 && (
                  <>
                    {/* Tap the left/right half to flip through photos. */}
                    <button
                      type="button"
                      aria-label="Previous photo"
                      className="absolute inset-y-0 left-0 w-1/2"
                      onClick={() => setShown((i) => (i - 1 + photos.length) % photos.length)}
                    />
                    <button
                      type="button"
                      aria-label="Next photo"
                      className="absolute inset-y-0 right-0 w-1/2"
                      onClick={() => setShown((i) => (i + 1) % photos.length)}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                      {photos.map((u, i) => (
                        <span
                          key={u}
                          className={`h-2 w-2 rounded-full border border-black/40 ${i === shown ? "bg-white" : "bg-white/40"}`}
                        />
                      ))}
                    </div>
                  </>
                )}
                <div className="absolute inset-x-3 top-3 flex items-start justify-end">
                  <div
                    className="border-ink shadow-hard-sm rounded-2xl border-2 px-3 py-1.5 text-right"
                    style={{ background: AURA_COLORS[tier] }}
                    aria-label={`Popularity score ${profile.auraScore ?? "unrated"}`}
                  >
                    <div className="text-2xl leading-none font-black tabular-nums sm:text-3xl">
                      {profile.auraScore === null ? (
                        "NEW"
                      ) : (
                        <>
                          <AnimatedNumber value={profile.auraScore} />%
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </AuraFrame>
            <p className="text-center text-sm font-black tabular-nums">
              {formatCount(profile.voteCount)} {profile.voteCount === 1 ? "vote" : "votes"} ·{" "}
              {formatCount(profile.generalCount)} {profile.generalCount === 1 ? "comment" : "comments"}
            </p>
          </motion.div>

          {/* Details & controls */}
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-muted flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-extrabold tracking-wider uppercase lg:justify-start">
                <Link href={`/b/${profile.bubble.slug}`} className="hover:text-ink flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {profile.bubble.name}
                </Link>
              </p>
              <h1 className="text-center text-3xl leading-none font-black tracking-tight uppercase sm:text-5xl lg:text-left">
                {profile.displayName}
              </h1>
            </div>

            <VoteConsole profile={profile} />

            <CommentsPanel profile={profile} />
          </div>
        </div>
      </div>

      {
        <ReportDialog
          open={reporting}
          onOpenChange={setReporting}
          targetType="PROFILE"
          targetId={profile.id}
          subject={profile.displayName}
        />
      }
    </div>
  );
}
