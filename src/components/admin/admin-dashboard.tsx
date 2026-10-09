"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheck, ExternalLink, EyeOff, Eye, Trash2, Ban, X } from "lucide-react";
import { toast } from "sonner";
import { useReports, useResolveReport } from "@/hooks/api";
import { Pills } from "@/components/ui/pills";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";
import { REPORT_REASONS } from "@/lib/validation";
import { errorMessage } from "@/lib/api/client";
import type { ReportDto } from "@/types/api";
import { timeAgo } from "@/lib/utils";

type Status = "OPEN" | "ACTIONED" | "DISMISSED";

export function AdminDashboard() {
  const [status, setStatus] = useState<Status>("OPEN");
  const { data, isPending, isError, error, refetch } = useReports(status);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 py-6 sm:px-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight uppercase">
          <ShieldCheck className="h-7 w-7" strokeWidth={2.5} /> Moderation queue
        </h1>
        <p className="text-muted text-xs font-bold">
          Reports from the community. Comments and messages auto-hide after 3 distinct reports until reviewed.
        </p>
      </div>
      <Pills
        ariaLabel="Report status"
        value={status}
        onChange={setStatus}
        options={[
          { value: "OPEN", label: "Open" },
          { value: "ACTIONED", label: "Actioned" },
          { value: "DISMISSED", label: "Dismissed" },
        ]}
      />
      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : data.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="All clear" body="No reports in this queue." />
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <ReportRow key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportRow({ r }: { r: ReportDto }) {
  const resolve = useResolveReport();
  const reason = REPORT_REASONS.find((x) => x.id === r.reason)?.label ?? r.reason;
  const act = (action: string, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    resolve.mutate(
      { id: r.id, action },
      {
        onSuccess: () => toast.success(`Report ${action === "dismiss" ? "dismissed" : "actioned"}`),
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <li className="border-ink shadow-hard-sm space-y-3 rounded-2xl border-2 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-extrabold uppercase">
        <span className="border-ink bg-aura-mid rounded-md border-2 px-1.5">{r.targetType}</span>
        <span className="border-ink bg-aura-low/40 rounded-md border-2 px-1.5">{reason}</span>
        {r.reportCount > 1 && (
          <span className="border-ink bg-ink rounded-md border-2 px-1.5 text-white">{r.reportCount} reports</span>
        )}
        {r.target?.hidden && <span className="border-ink rounded-md border-2 px-1.5">Hidden</span>}
        <span className="text-muted ml-auto normal-case">
          by @{r.reporter} · {timeAgo(r.createdAt)}
        </span>
      </div>
      {r.target ? (
        <div className="border-ink bg-surface rounded-xl border-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-black">{r.target.title}</p>
            {r.target.href && (
              <Link
                href={r.target.href}
                target="_blank"
                className="flex items-center gap-1 text-[11px] font-extrabold underline"
              >
                Open <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          {r.target.ownerHandle && <p className="text-muted text-[11px] font-bold">Owner @{r.target.ownerHandle}</p>}
          {r.target.body && <p className="text-ink-2 mt-1 line-clamp-3 text-sm font-semibold">{r.target.body}</p>}
        </div>
      ) : (
        <p className="text-muted text-xs font-bold">The reported content was already deleted.</p>
      )}
      {r.details && <p className="text-ink-2 text-xs font-semibold">“{r.details}”</p>}
      {r.status === "OPEN" && (
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="secondary" onClick={() => act("dismiss")} disabled={resolve.isPending}>
            <X className="h-3.5 w-3.5" /> Dismiss
          </Button>
          {r.target && !r.target.hidden && (
            <Button size="xs" variant="boost" onClick={() => act("hide")} disabled={resolve.isPending}>
              <EyeOff className="h-3.5 w-3.5" /> Hide
            </Button>
          )}
          {r.target?.hidden && (
            <Button size="xs" variant="aura" onClick={() => act("restore")} disabled={resolve.isPending}>
              <Eye className="h-3.5 w-3.5" /> Restore
            </Button>
          )}
          {r.target && (
            <Button
              size="xs"
              variant="danger"
              onClick={() => act("delete", "Permanently delete this content?")}
              disabled={resolve.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          {r.target?.ownerHandle && (
            <Button
              size="xs"
              variant="primary"
              onClick={() =>
                act("ban", `Ban @${r.target!.ownerHandle}? They will be logged out and their profile hidden.`)
              }
              disabled={resolve.isPending}
            >
              <Ban className="h-3.5 w-3.5" /> Ban owner
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
