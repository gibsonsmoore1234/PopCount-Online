"use client";

import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  children,
  className,
  title,
  description,
  hideClose,
  size = "md",
  onInteractOutside,
  onEscapeKeyDown,
}: {
  children: ReactNode;
  className?: string;
  title: ReactNode;
  description?: ReactNode;
  hideClose?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  onInteractOutside?: (e: Event) => void;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}) {
  return (
    <D.Portal>
      <D.Overlay className="bg-ink/60 data-[state=open]:animate-fade-in fixed inset-0 z-[1000] backdrop-blur-[3px]" />
      <D.Content
        onInteractOutside={onInteractOutside}
        onEscapeKeyDown={onEscapeKeyDown}
        className={cn(
          "border-ink shadow-hard-lg data-[state=open]:animate-pop-in fixed top-1/2 left-1/2 z-[1001] flex max-h-[min(92dvh,900px)] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[3px] bg-white focus:outline-none",
          { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size],
          className,
        )}
      >
        <div className="border-ink flex items-start justify-between gap-4 border-b-2 px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-lg font-black tracking-tight uppercase">{title}</D.Title>
            {description ? (
              <D.Description className="text-muted mt-0.5 text-xs font-semibold">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
            )}
          </div>
          {!hideClose && (
            <D.Close
              aria-label="Close"
              className="border-ink hover:bg-surface-2 -mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 bg-white transition"
            >
              <X className="h-4 w-4" strokeWidth={3} />
            </D.Close>
          )}
        </div>
        <div className="pc-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      </D.Content>
    </D.Portal>
  );
}
