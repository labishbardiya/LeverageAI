"use client";

import type { CallStatus } from "@/lib/ui/types";

/** Dark ink on light pills — readable on light glass and dark WA headers */
const STYLES: Record<CallStatus, string> = {
  idle: "bg-white/90 text-[var(--ink-muted)] border border-black/10",
  dialing: "bg-white text-[var(--ink)] border border-black/12",
  negotiating: "bg-[#25d366] text-white border border-[#1da851]",
  done: "bg-white text-[var(--ink)] border border-black/12",
  declined: "bg-white/80 text-[var(--ink-muted)] border border-black/10",
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
