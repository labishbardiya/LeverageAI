"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/ui/types";

type Props = {
  lines: TranscriptLine[];
  /** Visible rows at once (~3 WhatsApp-style bubbles) */
  visibleCount?: number;
  highlightTs?: number | null;
  onLineClick?: (ts: number) => void;
};

/**
 * Full conversation scroll; ~3 bubbles visible.
 * Agent/negotiator = left (incoming), vendor = right (outgoing WhatsApp style).
 * New messages animate in like WhatsApp send.
 */
export function TranscriptTicker({
  lines,
  visibleCount = 3,
  highlightTs = null,
  onLineClick,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevLen = useRef(0);

  // Approximate bubble height including gap (~72px) × 3
  const viewportMaxH = visibleCount * 76;

  useEffect(() => {
    const n = lines.filter((l) => {
      const t = (l.text || "").trim();
      if (!t) return false;
      if (l.speaker === "system" && /^\[bridge\]/i.test(t)) return false;
      if (l.speaker === "system" && /kickoff sent/i.test(t)) return false;
      return true;
    }).length;
    if (n > prevLen.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    prevLen.current = n;
  }, [lines]);

  // Hide internal orchestration markers (e.g. old "[bridge] kickoff…")
  const visible = lines.filter((l) => {
    const t = (l.text || "").trim();
    if (!t) return false;
    if (l.speaker === "system" && /^\[bridge\]/i.test(t)) return false;
    if (l.speaker === "system" && /kickoff sent/i.test(t)) return false;
    return true;
  });

  if (!visible.length) {
    return (
      <div
        className="flex items-center justify-center rounded-xl bg-white/20 px-3"
        style={{ minHeight: viewportMaxH }}
      >
        <p className="text-xs italic text-[var(--color-ash)]">
          Waiting for conversation…
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/40 bg-white/25">
      <div
        ref={scrollerRef}
        className="wa-chat-scroll overflow-y-auto overscroll-contain px-2.5 py-2"
        style={{
          maxHeight: viewportMaxH,
          minHeight: Math.min(viewportMaxH, 120),
        }}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <ul className="flex flex-col gap-2">
          {visible.map((line, idx) => {
            const isAgent =
              line.speaker === "negotiator" || line.speaker === "system";
            const isVendor = line.speaker === "vendor";
            const active =
              highlightTs != null && Math.abs(line.ts - highlightTs) < 0.5;
            const isNew = idx >= Math.max(0, visible.length - 3);

            return (
              <li
                key={line.id}
                id={`ts-${line.ts}`}
                className={`flex w-full ${
                  isVendor ? "justify-end" : "justify-start"
                } ${isNew ? "wa-msg-in" : ""}`}
                onClick={() => onLineClick?.(line.ts)}
              >
                <div
                  className={`relative max-w-[88%] px-2.5 py-1.5 text-xs leading-snug ${
                    isVendor
                      ? "wa-bubble-out text-[var(--color-ink)]"
                      : isAgent
                        ? "wa-bubble-in text-[var(--color-graphite)]"
                        : "rounded-lg bg-white/40 text-[var(--color-smoke)]"
                  } ${
                    active
                      ? "ring-2 ring-[var(--color-ink)]/25 ring-offset-1 ring-offset-transparent"
                      : ""
                  } ${onLineClick ? "cursor-pointer" : ""}`}
                >
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-55">
                    {isVendor
                      ? "Provider"
                      : line.speaker === "system"
                        ? "System"
                        : "Agent"}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{line.text}</p>
                  <p className="mt-0.5 text-right text-[9px] tabular-nums opacity-45">
                    {formatTs(line.ts)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>
      {lines.length > visibleCount && (
        <p className="border-t border-white/35 bg-white/30 px-2 py-1 text-center text-[10px] text-[var(--color-ash)]">
          Scroll · {lines.length} messages
        </p>
      )}
    </div>
  );
}

function formatTs(ts: number): string {
  // ts may be seconds into call or ms residue — show compact
  if (ts > 10_000) {
    const s = Math.floor(ts / 1000) % 3600;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  }
  const m = Math.floor(ts / 60);
  const r = Math.floor(ts % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}
