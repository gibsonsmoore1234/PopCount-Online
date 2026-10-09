"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageCircle, Lightbulb, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";
import { useAddComment, useComments, useDeleteComment, useMe } from "@/hooks/api";
import { useAuthGuard } from "@/hooks/use-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { Avatar } from "@/components/aura/photo";
import { errorMessage } from "@/lib/api/client";
import type { CommentDto, CommentKind, ProfileDetail } from "@/types/api";
import { cn, timeAgo } from "@/lib/utils";
import { ReportDialog } from "./report-dialog";

/** Discussion: general comments + a dedicated thread for constructive Aura advice. */
export function CommentsPanel({ profile }: { profile: ProfileDetail }) {
  const [kind, setKind] = useState<CommentKind>("COMMENT");
  const tabs = [
    { id: "COMMENT" as const, label: "Comments", count: profile.generalCount, icon: MessageCircle },
    { id: "ADVICE" as const, label: "Aura Advice", count: profile.adviceCount, icon: Lightbulb },
  ];

  return (
    <section
      className="border-ink shadow-hard space-y-4 rounded-2xl border-2 bg-white p-4 sm:p-5"
      aria-label="Discussion"
    >
      <div role="tablist" className="border-ink flex gap-1 border-b-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={kind === t.id}
            onClick={() => setKind(t.id)}
            className={cn(
              "-mb-0.5 flex items-center gap-1.5 border-b-4 px-3 py-2 text-xs font-black tracking-tight uppercase sm:text-sm",
              kind === t.id ? "border-ink" : "text-muted hover:text-ink border-transparent",
            )}
          >
            <t.icon className="h-4 w-4" strokeWidth={2.5} /> {t.label}
            <span className="border-ink bg-surface rounded-full border-2 px-1.5 text-[10px] tabular-nums">
              {t.count}
            </span>
          </button>
        ))}
      </div>
      <Thread key={kind} profile={profile} kind={kind} />
    </section>
  );
}

function Thread({ profile, kind }: { profile: ProfileDetail; kind: CommentKind }) {
  const comments = useComments(profile.id, kind);
  const add = useAddComment(profile.id, kind);
  const del = useDeleteComment(profile.id, kind);
  const guard = useAuthGuard();
  const { data: me } = useMe();
  const [body, setBody] = useState("");
  const [reporting, setReporting] = useState<CommentDto | null>(null);
  const items = comments.data?.pages.flatMap((p) => p.items) ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guard("Create an account to join the conversation.")) return;
    const text = body.trim();
    if (text.length < 2) return;
    add.mutate(text, {
      onSuccess: () => {
        setBody("");
        toast.success(kind === "ADVICE" ? "Advice posted" : "Comment posted");
      },
      onError: (err) => toast.error(errorMessage(err)),
    });
  };

  return (
    <div className="space-y-4">
      {kind === "ADVICE" && (
        <p className="border-ink bg-aura-high/30 rounded-xl border-2 px-3 py-2 text-xs font-bold">
          💡 Constructive tips only — how could {profile.displayName.split(" ")[0]} level up their Aura? No comments
          about bodies.
        </p>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          placeholder={kind === "ADVICE" ? "Share constructive advice…" : "Write a public campus comment..."}
          aria-label={kind === "ADVICE" ? "Write advice" : "Write a comment"}
          onFocus={() => !me && guard("Create an account to join the conversation.")}
        />
        <Button type="submit" disabled={add.isPending || body.trim().length < 2}>
          {add.isPending && <Spinner />} Post
        </Button>
      </form>

      {comments.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={kind === "ADVICE" ? <Lightbulb className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
          title={kind === "ADVICE" ? "No advice yet" : "No comments yet"}
          body="Be the first — keep it kind."
        />
      ) : (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {items.map((c) => (
              <motion.li
                key={c.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="group border-ink bg-surface flex gap-3 rounded-xl border-2 p-3"
              >
                <Avatar src={c.author.photoUrl} name={c.author.handle} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    {c.author.profileId ? (
                      <Link href={`/p/${c.author.profileId}`} className="truncate font-black hover:underline">
                        @{c.author.handle}
                      </Link>
                    ) : (
                      <span className="truncate font-black">@{c.author.handle}</span>
                    )}
                    {c.author.handle === profile.handle && (
                      <span className="border-ink bg-aura-mid rounded border px-1 text-[9px] font-black uppercase">
                        Owner
                      </span>
                    )}
                    <time
                      dateTime={c.createdAt}
                      className="text-muted text-[10px] font-bold"
                      title={new Date(c.createdAt).toLocaleString()}
                    >
                      {timeAgo(c.createdAt)}
                    </time>
                    <span className="ml-auto flex gap-1 opacity-60 transition group-hover:opacity-100">
                      {c.canDelete && (
                        <button
                          aria-label="Delete comment"
                          onClick={() => del.mutate(c.id)}
                          className="rounded p-1 hover:bg-white"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {me && !c.isMine && (
                        <button
                          aria-label="Report comment"
                          onClick={() => setReporting(c)}
                          className="rounded p-1 hover:bg-white"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="text-ink-2 mt-0.5 text-sm font-semibold break-words whitespace-pre-wrap">{c.body}</p>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      {comments.hasNextPage && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={() => comments.fetchNextPage()}
          disabled={comments.isFetchingNextPage}
        >
          {comments.isFetchingNextPage && <Spinner />} Load older
        </Button>
      )}

      {reporting && (
        <ReportDialog
          open
          onOpenChange={(o) => !o && setReporting(null)}
          targetType="COMMENT"
          targetId={reporting.id}
          subject={`@${reporting.author.handle}'s comment`}
        />
      )}
    </div>
  );
}
