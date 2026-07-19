"use client";

import { useRef, useState } from "react";
import type { SessionCard, VerticalConfig } from "@/lib/ui/types";
import { uiCopy } from "@/lib/ui/types";
import { PriceDisplay } from "./PriceDisplay";
import { StatusChip } from "./StatusChip";
import { TranscriptTicker } from "./TranscriptTicker";

type Props = {
  vertical: VerticalConfig;
  sessions: SessionCard[];
  highlight?: { vendor_id: string; ts: number } | null;
  onHighlightClear?: () => void;
};

export function CallsColumn({
  vertical,
  sessions,
  highlight,
  onHighlightClear,
}: Props) {
  const copy = uiCopy(vertical);
  const active = sessions.filter(
    (s) => s.status === "dialing" || s.status === "negotiating",
  ).length;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3.5">
      <header>
        <p className="label-section !text-[var(--glass-text-muted)]">Calls</p>
        <h2 className="mt-0.5 text-[17px] font-medium tracking-tight text-[var(--glass-text)]">
          {copy.calls_column_title}
        </h2>
        <p className="text-[13px] text-[var(--glass-text-secondary)]">
          {active > 0
            ? `${active} live · WhatsApp-style chats`
            : "3 parallel negotiations"}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
        {sessions.map((s) => (
          <CallCard
            key={s.vendor_id}
            session={s}
            highlightTs={
              highlight?.vendor_id === s.vendor_id ? highlight.ts : null
            }
            onHeard={onHighlightClear}
          />
        ))}
      </div>
    </section>
  );
}

function CallCard({
  session,
  highlightTs,
  onHeard,
}: {
  session: SessionCard;
  highlightTs: number | null;
  onHeard?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const hasAudio = Boolean(session.audio_url);
  const live =
    session.status === "dialing" || session.status === "negotiating";

  const toggleAudio = () => {
    if (!session.audio_url || !audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play();
      setPlaying(true);
    }
  };

  return (
    <article
      className={`glass-inner overflow-hidden p-0 transition-shadow ${
        live
          ? "ring-1 ring-white/30 shadow-[0_0_24px_rgba(107,92,231,0.18)]"
          : ""
      }`}
    >
      {/* Chat header bar — WhatsApp green strip feel */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[rgba(7,94,84,0.55)] px-3 py-2.5 backdrop-blur-md">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold text-white"
              aria-hidden
            >
              {session.vendor_name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-[13px] font-semibold text-white">
                {session.vendor_name}
              </h3>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <StatusChip status={session.status} />
                {session.competing_bid_used && (
                  <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                    Bid used
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={!hasAudio}
          onClick={toggleAudio}
          title={hasAudio ? "Toggle call audio" : "Audio unavailable"}
          className="shrink-0 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white hover:enabled:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {playing ? "Pause" : "Audio"}
        </button>
        {session.audio_url && (
          <audio
            ref={audioRef}
            src={session.audio_url}
            onEnded={() => setPlaying(false)}
            className="hidden"
          />
        )}
      </div>

      <div className="px-3 pt-2.5">
        <PriceDisplay
          price={session.current_price}
          className="!text-[2rem] !text-[var(--ink)]"
        />
      </div>

      <div className="p-2.5 pt-2">
        <TranscriptTicker
          lines={session.transcript}
          visibleCount={4}
          highlightTs={highlightTs}
          onLineClick={() => onHeard?.()}
        />
      </div>
    </article>
  );
}
