"use client";

import type { TranscriptLine } from "@/lib/ui/types";

type Props = {
  lines: TranscriptLine[];
  max?: number;
  highlightTs?: number | null;
  onLineClick?: (ts: number) => void;
  dense?: boolean;
};

export function TranscriptTicker({
  lines,
  max = 3,
  highlightTs = null,
  onLineClick,
  dense = true,
}: Props) {
  const shown = lines.slice(-max);

  if (!shown.length) {
    return (
      <p className="text-xs text-slate-400 italic">Waiting for conversation…</p>
    );
  }

  return (
    <ul className={`space-y-1.5 ${dense ? "text-xs" : "text-sm"}`}>
      {shown.map((line) => {
        const active =
          highlightTs != null && Math.abs(line.ts - highlightTs) < 0.5;
        const who =
          line.speaker === "negotiator"
            ? "You"
            : line.speaker === "vendor"
              ? "Them"
              : "·";
        return (
          <li
            key={line.id}
            id={`ts-${line.ts}`}
            className={`rounded px-1.5 py-1 leading-snug ${
              active
                ? "bg-emerald-50 ring-1 ring-emerald-400"
                : "bg-slate-50"
            } ${onLineClick ? "cursor-pointer hover:bg-slate-100" : ""}`}
            onClick={() => onLineClick?.(line.ts)}
          >
            <span className="font-medium text-slate-500 mr-1.5">{who}</span>
            <span className="text-slate-700">{line.text}</span>
            <span className="ml-1.5 text-[10px] text-slate-400 tabular-nums">
              {line.ts}s
            </span>
          </li>
        );
      })}
    </ul>
  );
}
