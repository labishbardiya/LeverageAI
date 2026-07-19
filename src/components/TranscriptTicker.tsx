"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/ui/types";

type Props = {
  lines: TranscriptLine[];
  /** Visible rows at once (~4 WhatsApp-style bubbles) */
  visibleCount?: number;
  highlightTs?: number | null;
  onLineClick?: (ts: number) => void;
};

/**
 * WhatsApp-style live chat:
 * Agent/negotiator = left white bubble
 * Vendor/provider = right green bubble
 * Classic WA wallpaper + tails + timestamps
 */
export function TranscriptTicker({
  lines,
  visibleCount = 4,
  highlightTs = null,
  onLineClick,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const prevLen = useRef(0);

  const viewportMaxH = visibleCount * 82;

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
        className="wa-chat-shell wa-empty flex items-center justify-center px-3"
        style={{ minHeight: viewportMaxH }}
      >
        <span className="rounded-lg bg-[#fffef5]/95 px-3 py-1.5 text-[11px] text-[#54656f] shadow-sm">
          Waiting for messages…
        </span>
      </div>
    );
  }

  return (
    <div className="wa-chat-shell">
      <div
        ref={scrollerRef}
        className="wa-chat-scroll overflow-y-auto overscroll-contain px-2.5 py-2.5"
        style={{
          maxHeight: viewportMaxH,
          minHeight: Math.min(viewportMaxH, 140),
        }}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <ul className="flex flex-col gap-1.5">
          {visible.map((line, idx) => {
            const isSystem = line.speaker === "system";
            const isVendor = line.speaker === "vendor";
            const isAgent =
              line.speaker === "negotiator" ||
              (!isVendor && !isSystem);
            const active =
              highlightTs != null && Math.abs(line.ts - highlightTs) < 0.5;
            const isNew = idx >= Math.max(0, visible.length - 3);

            if (isSystem) {
              return (
                <li
                  key={line.id}
                  id={`ts-${line.ts}`}
                  className={`flex w-full justify-center ${isNew ? "wa-msg-in" : ""}`}
                >
                  <div className="wa-bubble-system relative max-w-[90%] px-2.5 py-1 text-[11px] leading-snug">
                    {line.text}
                  </div>
                </li>
              );
            }

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
                  className={`relative max-w-[86%] px-2.5 py-1.5 text-[12.5px] leading-[1.35] ${
                    isVendor
                      ? "wa-bubble-out"
                      : isAgent
                        ? "wa-bubble-in"
                        : "wa-bubble-in"
                  } ${
                    active ? "ring-2 ring-[#25d366]/60 ring-offset-1" : ""
                  } ${onLineClick ? "cursor-pointer" : ""}`}
                >
                  <p className="wa-meta">
                    {isVendor ? "Provider" : "Agent"}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-[#111b21]">
                    {line.text}
                    <span className="wa-time">
                      {formatTs(line.ts)}
                      {isVendor ? (
                        <span className="wa-ticks" aria-hidden>
                          ✓✓
                        </span>
                      ) : null}
                    </span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </div>
      {visible.length > visibleCount && (
        <p className="wa-footer px-2 py-1 text-center text-[10px]">
          Scroll for full chat · {visible.length} messages
        </p>
      )}
    </div>
  );
}

function formatTs(ts: number): string {
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
