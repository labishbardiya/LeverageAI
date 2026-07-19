"use client";

import type { CallStatus } from "@/lib/ui/types";

const STYLES: Record<CallStatus, string> = {
  idle: "bg-white/35 text-[var(--color-ash)] border border-white/40",
  dialing:
    "bg-white/50 text-[var(--color-graphite)] border border-white/60",
  negotiating:
    "bg-[var(--color-ink)] text-white border border-[var(--color-ink)]",
  done: "bg-white/55 text-[var(--color-ink)] border border-[var(--color-ink)]/25",
  declined: "bg-white/30 text-[var(--color-smoke)] border border-white/40",
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
