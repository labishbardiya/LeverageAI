"use client";

import type { CallStatus } from "@/lib/ui/types";

const STYLES: Record<CallStatus, string> = {
  idle: "bg-[var(--color-warm-taupe)] text-[var(--color-ash)]",
  dialing:
    "bg-[var(--color-warm-taupe)] text-[var(--color-graphite)] border border-[var(--color-stone)]",
  negotiating:
    "bg-[var(--color-ink)] text-white border border-[var(--color-ink)]",
  done: "bg-[var(--color-eggshell)] text-[var(--color-ink)] border border-[var(--color-ink)]",
  declined: "bg-[var(--color-stone)] text-[var(--color-smoke)]",
};

const LABELS: Record<CallStatus, string> = {
  idle: "Idle",
  dialing: "Dialing",
  negotiating: "Negotiating",
  done: "Done",
  declined: "Declined",
};

export function StatusChip({ status }: { status: CallStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STYLES[status]}`}
    >
      {(status === "dialing" || status === "negotiating") && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {LABELS[status]}
    </span>
  );
}
