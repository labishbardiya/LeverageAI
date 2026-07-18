"use client";

import type { CallStatus } from "@/lib/ui/types";

const STYLES: Record<CallStatus, string> = {
  idle: "bg-slate-100 text-slate-500",
  dialing: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  negotiating: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
  done: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  declined: "bg-slate-200 text-slate-600",
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
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
