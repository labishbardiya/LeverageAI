"use client";

import { useState } from "react";
import type {
  RankedDeal,
  SessionCard,
  VerticalConfig,
} from "@/lib/ui/types";
import { redFlagThresholdPct, uiCopy } from "@/lib/ui/types";

type Props = {
  vertical: VerticalConfig;
  phase: string;
  ranked: RankedDeal[];
  sessions: SessionCard[];
  onListen: (vendor_id: string, ts: number) => void;
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function redBanner(vertical: VerticalConfig, pct: number): string {
  if (vertical.red_flag.banner_template) {
    return vertical.red_flag.banner_template.replace("{pct}", String(pct));
  }
  return `${pct}% below market — bait-price risk`;
}

export function DealColumn({
  vertical,
  phase,
  ranked,
  sessions,
  onListen,
}: Props) {
  const ready = phase === "complete" && ranked.length > 0;
  const copy = uiCopy(vertical);

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
          Deal
        </p>
        <h2 className="text-lg font-semibold text-slate-900">
          {copy.deal_column_title}
        </h2>
        <p className="text-sm text-slate-500">
          Ranked quotes · red flags (≥{redFlagThresholdPct(vertical)}% under mid)
        </p>
      </header>

      {!ready ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
          <p className="text-sm text-slate-400">
            {phase === "calling"
              ? "Ranking appears when all three calls finish."
              : "Confirm your job to start calls."}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto">
          {ranked.map((r) => (
            <DealCard
              key={r.session.vendor_id + r.rank}
              deal={r}
              vertical={vertical}
              onListen={onListen}
              fullSession={
                sessions.find((s) => s.vendor_id === r.session.vendor_id) ||
                r.session
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DealCard({
  deal,
  vertical,
  onListen,
  fullSession,
}: {
  deal: RankedDeal;
  vertical: VerticalConfig;
  onListen: (vendor_id: string, ts: number) => void;
  fullSession: SessionCard;
}) {
  const [open, setOpen] = useState(deal.recommended || deal.red_flag);
  const s = deal.session;
  const price = s.current_price;

  const downloadTranscript = () => {
    const payload = {
      vendor: s.vendor_name,
      vendor_id: s.vendor_id,
      outcome: s.outcome,
      price: s.current_price,
      line_items: s.line_items,
      transcript: fullSession.transcript,
      callback_at: s.callback_at,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${s.vendor_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAudio = () => {
    if (!s.audio_url) return;
    const a = document.createElement("a");
    a.href = s.audio_url;
    a.download = `call-${s.vendor_id}.mp3`;
    a.target = "_blank";
    a.click();
  };

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-sm ${
        deal.recommended
          ? "border-emerald-300 ring-1 ring-emerald-200"
          : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400">
              #{deal.rank}
            </span>
            <h3 className="font-semibold text-slate-900">{s.vendor_name}</h3>
            {deal.recommended && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                Recommended
              </span>
            )}
          </div>
          {price != null ? (
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {formatUsd(price)}
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-slate-500">
              {s.outcome === "documented_decline"
                ? "Documented decline"
                : s.outcome === "callback_commitment"
                  ? "Callback only"
                  : "No price"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          {open ? "Hide" : "Details"}
        </button>
      </div>

      {deal.red_flag && deal.red_flag_pct != null && (
        <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800 ring-1 ring-rose-200">
          {redBanner(vertical, deal.red_flag_pct)}
        </div>
      )}

      {deal.why && (
        <p className="mt-2 text-sm text-slate-600">{deal.why}</p>
      )}

      {s.callback_at && (
        <p className="mt-1 text-xs text-slate-500">
          Callback: <span className="font-medium">{s.callback_at}</span>
        </p>
      )}

      {open && s.line_items?.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          {s.line_items.map((li, i) => (
            <li
              key={`${li.label}-${i}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-slate-700">{li.label}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-medium text-slate-900">
                  {formatUsd(li.amount)}
                </span>
                {li.evidence_ts != null && (
                  <button
                    type="button"
                    onClick={() => onListen(s.vendor_id, li.evidence_ts!)}
                    className="text-[11px] font-medium text-emerald-700 hover:underline"
                  >
                    Listen
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadTranscript}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Download transcript
        </button>
        <button
          type="button"
          onClick={downloadAudio}
          disabled={!s.audio_url}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:enabled:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Download audio
        </button>
      </div>
    </article>
  );
}
