"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Hash, Plus, Send, Trash2, Flag, MessagesSquare, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateGroup,
  useDeleteMessage,
  useGroups,
  useMe,
  useMembership,
  useMessages,
  usePostMessage,
} from "@/hooks/api";
import { useUi } from "@/stores/ui-store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { Avatar } from "@/components/aura/photo";
import { ReportDialog } from "@/components/profile/report-dialog";
import { errorMessage } from "@/lib/api/client";
import type { BubbleSummary, GroupDto, MessageDto } from "@/types/api";
import { cn, timeAgo } from "@/lib/utils";

/** Groups & tabs: per-bubble group channels with live chat. */
export function GroupsPanel({ bubble }: { bubble: BubbleSummary }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: groups, isPending } = useGroups(bubble.slug);
  const [createOpen, setCreateOpen] = useState(false);
  const { data: me } = useMe();
  const promptAuth = useUi((s) => s.promptAuth);

  const activeSlug = params.get("g") ?? groups?.[0]?.slug;
  const active = groups?.find((g) => g.slug === activeSlug) ?? groups?.[0];

  const select = (slug: string) => {
    const sp = new URLSearchParams(params);
    sp.set("tab", "groups");
    sp.set("g", slug);
    router.replace(`${pathname}?${sp}`, { scroll: false });
  };

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <aside className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-muted text-xs font-black tracking-wider uppercase">Group channels</h2>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => (me ? setCreateOpen(true) : promptAuth("Create an account to start a group."))}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={3} /> New
          </Button>
        </div>
        {isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <nav
            className="pc-no-scrollbar flex gap-2 overflow-x-auto md:flex-col md:overflow-visible"
            aria-label="Groups"
          >
            {groups?.map((g) => (
              <button
                key={g.id}
                onClick={() => select(g.slug)}
                aria-current={active?.id === g.id}
                className={cn(
                  "border-ink flex shrink-0 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left transition md:w-full",
                  active?.id === g.id ? "bg-ink shadow-hard-sm text-white" : "hover:bg-surface-2 bg-white",
                )}
              >
                <Hash className="h-4 w-4 shrink-0" strokeWidth={3} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{g.name}</span>
                  <span
                    className={cn(
                      "hidden truncate text-[10px] font-semibold md:block",
                      active?.id === g.id ? "text-white/70" : "text-muted",
                    )}
                  >
                    {g.messageCount} messages{g.lastMessageAt ? ` · ${timeAgo(g.lastMessageAt)}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        )}
      </aside>

      {active ? (
        <Channel bubble={bubble} group={active} />
      ) : (
        !isPending && (
          <EmptyState
            icon={<MessagesSquare className="h-5 w-5" />}
            title="No groups yet"
            body="Start the first channel for this bubble."
          />
        )
      )}

      <CreateGroupDialog
        slug={bubble.slug}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(g) => select(g.slug)}
      />
    </div>
  );
}

function Channel({ bubble, group }: { bubble: BubbleSummary; group: GroupDto }) {
  const { data: me } = useMe();
  const { data: messages, isPending } = useMessages(group.id);
  const post = usePostMessage(group.id);
  const del = useDeleteMessage(group.id);
  const membership = useMembership(bubble.slug);
  const promptAuth = useUi((s) => s.promptAuth);
  const [body, setBody] = useState("");
  const [reporting, setReporting] = useState<MessageDto | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const isMember = Boolean(me?.memberships.includes(bubble.id));

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    stick.current = true;
  }, [group.id]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    stick.current = true;
    post.mutate(text, { onSuccess: () => setBody(""), onError: (err) => toast.error(errorMessage(err)) });
  };

  return (
    <section
      className="border-ink shadow-hard flex h-[max(420px,min(calc(100dvh-19rem),680px))] flex-col overflow-hidden rounded-2xl border-2 bg-white"
      aria-label={`#${group.name}`}
    >
      <header className="border-ink bg-surface flex items-center gap-2 border-b-2 px-4 py-3">
        <Hash className="h-5 w-5" strokeWidth={3} />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black">{group.name}</h3>
          {group.description && <p className="text-muted truncate text-[11px] font-semibold">{group.description}</p>}
        </div>
        <span className="text-muted ml-auto flex items-center gap-1 text-[10px] font-extrabold uppercase">
          <span className="animate-pulse-ring bg-aura-high h-2 w-2 rounded-full" /> Live
        </span>
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="pc-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {isPending ? (
          <div className="grid h-full place-items-center">
            <Spinner className="h-5 w-5" />
          </div>
        ) : messages && messages.length > 0 ? (
          messages.map((m) => (
            <div key={m.id} className={cn("group flex gap-2.5", m.isMine && "flex-row-reverse")}>
              <Avatar src={m.author.photoUrl} name={m.author.handle} size={30} className="mt-0.5" />
              <div className={cn("max-w-[78%] space-y-0.5", m.isMine && "items-end text-right")}>
                <div className={cn("flex items-center gap-1.5 text-[11px]", m.isMine && "flex-row-reverse")}>
                  {m.author.profileId ? (
                    <Link href={`/p/${m.author.profileId}`} className="font-extrabold hover:underline">
                      @{m.author.handle}
                    </Link>
                  ) : (
                    <span className="font-extrabold">@{m.author.handle}</span>
                  )}
                  <span className="text-muted font-semibold">{timeAgo(m.createdAt)}</span>
                  <span className="flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                    {(m.isMine || me?.role === "ADMIN") && (
                      <button
                        aria-label="Delete message"
                        onClick={() => del.mutate(m.id)}
                        className="hover:bg-surface-2 rounded p-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                    {me && !m.isMine && (
                      <button
                        aria-label="Report message"
                        onClick={() => setReporting(m)}
                        className="hover:bg-surface-2 rounded p-0.5"
                      >
                        <Flag className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </div>
                <p
                  className={cn(
                    "border-ink inline-block rounded-2xl border-2 px-3 py-1.5 text-left text-sm font-semibold break-words whitespace-pre-wrap",
                    m.isMine ? "bg-aura-high rounded-tr-md" : "rounded-tl-md bg-white",
                  )}
                >
                  {m.body}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-muted pt-10 text-center text-xs font-bold">No messages yet — say hi 👋</p>
        )}
      </div>

      {me && isMember ? (
        <form onSubmit={send} className="border-ink flex gap-2 border-t-2 p-3">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            placeholder={`Message #${group.name}`}
            aria-label="Message"
          />
          <Button type="submit" disabled={!body.trim() || post.isPending} aria-label="Send">
            {post.isPending ? <Spinner /> : <Send className="h-4 w-4" strokeWidth={2.5} />}
          </Button>
        </form>
      ) : (
        <div className="border-ink bg-surface flex items-center justify-between gap-3 border-t-2 px-4 py-3">
          <p className="text-ink-2 flex items-center gap-1.5 text-xs font-bold">
            <Lock className="h-3.5 w-3.5" /> Join {bubble.name} to chat in its groups.
          </p>
          <Button
            size="sm"
            onClick={() =>
              me
                ? membership.mutate(true, { onError: (e) => toast.error(errorMessage(e)) })
                : promptAuth(`Create an account to chat in ${bubble.name}'s groups.`)
            }
            disabled={membership.isPending}
          >
            Join bubble
          </Button>
        </div>
      )}
      {reporting && (
        <ReportDialog
          open
          onOpenChange={(o) => !o && setReporting(null)}
          targetType="MESSAGE"
          targetId={reporting.id}
          subject={`@${reporting.author.handle}'s message`}
        />
      )}
    </section>
  );
}

function CreateGroupDialog({
  slug,
  open,
  onOpenChange,
  onCreated,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (g: GroupDto) => void;
}) {
  const create = useCreateGroup(slug);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New group channel" description="Channels are public to everyone in this bubble." size="sm">
        <form
          className="space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { name, description },
              {
                onSuccess: ({ group }) => {
                  toast.success(`#${group.name} created`);
                  setName("");
                  setDescription("");
                  onOpenChange(false);
                  onCreated(group);
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <Field label="Channel name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder="e.g. intramurals"
              required
              minLength={2}
            />
          </Field>
          <Field label="Description">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={120}
              placeholder="What's this channel for?"
            />
          </Field>
          <Button type="submit" className="w-full" disabled={create.isPending || name.trim().length < 2}>
            {create.isPending && <Spinner />} Create channel
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
