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
        <p className="label-section">Calls</p>
        <h2 className="mt-0.5 text-[17px] font-medium tracking-tight text-[var(--color-ink)]">
          {copy.calls_column_title}
        </h2>
        <p className="text-[13px] text-[var(--color-smoke)]">
          {active > 0
            ? `${active} live · 3 agents in parallel`
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
      className={`glass-inner p-3.5 transition-shadow ${
        live ? "ring-1 ring-white/60 shadow-[0_0_20px_rgba(107,92,231,0.12)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-medium text-[var(--color-ink)]">
            {session.vendor_name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StatusChip status={session.status} />
            {session.competing_bid_used && (
              <span className="rounded-full bg-white/50 px-2 py-0.5 text-[11px] font-medium text-[var(--color-graphite)] ring-1 ring-white/60">
                Competing bid used
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={!hasAudio}
          onClick={toggleAudio}
          title={hasAudio ? "Toggle call audio" : "Audio unavailable"}
          className="shrink-0 rounded-full border border-white/50 bg-white/40 px-2.5 py-1 text-xs font-medium text-[var(--color-graphite)] hover:enabled:bg-white/70 disabled:cursor-not-allowed disabled:opacity-40"
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

      <div className="mt-2.5">
        <PriceDisplay price={session.current_price} />
      </div>

      <div className="mt-3 border-t border-white/35 pt-2.5">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-ash)]">
          Live transcript
        </p>
        <TranscriptTicker
          lines={session.transcript}
          visibleCount={3}
          highlightTs={highlightTs}
          onLineClick={() => onHeard?.()}
        />
      </div>
    </article>
  );
}
