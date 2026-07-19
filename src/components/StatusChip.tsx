"use client";

import type { CallStatus } from "@/lib/ui/types";

const STYLES: Record<CallStatus, string> = {
  idle: "bg-white/15 text-white/70 border border-white/20",
  dialing: "bg-white/20 text-white border border-white/30",
  negotiating: "bg-[#25d366] text-white border border-[#1da851]",
  done: "bg-white/90 text-[#0c0b0a] border border-white/40",
  declined: "bg-white/10 text-white/60 border border-white/15",
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
