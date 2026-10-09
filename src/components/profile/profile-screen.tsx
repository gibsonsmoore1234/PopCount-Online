"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Share2, Flag, Pencil, Trash2, MapPin, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useDeleteProfile, useProfile } from "@/hooks/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/misc";
import { AuraFrame } from "@/components/aura/aura";
import { Photo } from "@/components/aura/photo";
import { AURA_COLORS, auraTier, formatCount } from "@/lib/aura";
import { errorMessage } from "@/lib/api/client";
import type { ProfileDetail } from "@/types/api";
import { AnimatedNumber, VoteConsole } from "./vote-console";
import { CommentsPanel } from "./comments-panel";
import { ProfileFormDialog } from "./profile-form";
import { ReportDialog } from "./report-dialog";

/** Layer 3 — full-screen "Tea-app" style profile takeover. */
export function ProfileScreen({ initial }: { initial: ProfileDetail }) {
  const { data: profile = initial } = useProfile(initial.id, initial);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const tier = auraTier(profile.auraScore);

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
          {!profile.isOwner && (
            <Button variant="secondary" size="icon-sm" aria-label="Report profile" onClick={() => setReporting(true)}>
              <Flag className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          )}
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
                <Photo src={profile.photoUrl} alt={profile.displayName} eager />
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
              {formatCount(profile.voteCount)} {profile.voteCount === 1 ? "vote" : "votes"}
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

            {profile.isOwner ? (
              <OwnerPanel onEdit={() => setEditing(true)} onDelete={() => setDeleting(true)} />
            ) : (
              <VoteConsole profile={profile} />
            )}

            <CommentsPanel profile={profile} />
          </div>
        </div>
      </div>

      {profile.isOwner && <ProfileFormDialog open={editing} onOpenChange={setEditing} profile={profile} />}
      {profile.isOwner && <DeleteProfileDialog open={deleting} onOpenChange={setDeleting} profile={profile} />}
      {!profile.isOwner && (
        <ReportDialog
          open={reporting}
          onOpenChange={setReporting}
          targetType="PROFILE"
          targetId={profile.id}
          subject={profile.displayName}
        />
      )}
    </div>
  );
}

function OwnerPanel({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
      <Button variant="secondary" size="sm" onClick={onEdit}>
        <Pencil className="h-4 w-4" strokeWidth={2.5} /> Edit profile
      </Button>
      <Button variant="danger" size="sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4" strokeWidth={2.5} /> Delete profile
      </Button>
    </div>
  );
}

function DeleteProfileDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profile: ProfileDetail;
}) {
  const del = useDeleteProfile(profile.id);
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Delete your profile?" size="sm">
        <div className="space-y-4 p-5">
          <p className="text-ink-2 text-sm font-semibold">
            This permanently removes your profile, its {profile.voteCount.toLocaleString()} votes and every comment on
            it. Your account stays, so you can create a new profile later.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={del.isPending}
              onClick={() =>
                del.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Profile deleted");
                    router.push(`/b/${profile.bubble.slug}`);
                  },
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              {del.isPending && <Spinner />} Delete forever
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
