"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { useReport } from "@/hooks/api";
import { REPORT_REASONS } from "@/lib/validation";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  subject,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetType: "PROFILE" | "COMMENT" | "MESSAGE" | "BUBBLE";
  targetId: string;
  subject: string;
}) {
  const report = useReport();
  const [reason, setReason] = useState<string>("harassment");
  const [details, setDetails] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Report" description={`Tell our moderators what's wrong with ${subject}.`} size="sm">
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            report.mutate(
              { targetType, targetId, reason, details },
              {
                onSuccess: () => {
                  toast.success("Report sent", { description: "Thanks — a moderator will review it." });
                  onOpenChange(false);
                  setDetails("");
                },
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <div role="radiogroup" aria-label="Reason" className="grid gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                type="button"
                key={r.id}
                role="radio"
                aria-checked={reason === r.id}
                onClick={() => setReason(r.id)}
                className={cn(
                  "border-ink rounded-xl border-2 px-3 py-2 text-left text-xs font-extrabold transition",
                  reason === r.id ? "bg-ink text-white" : "hover:bg-surface-2 bg-white",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Field label="Details (optional)">
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Anything that helps us review faster"
            />
          </Field>
          <Button type="submit" variant="danger" className="w-full" disabled={report.isPending}>
            {report.isPending && <Spinner />} Submit report
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
