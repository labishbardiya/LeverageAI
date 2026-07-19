"use client";

import { useState } from "react";
import type {
  BenchmarkEntry,
  DealReviewUi,
  RankedDeal,
  SessionCard,
  VerticalConfig,
} from "@/lib/ui/types";
import { uiCopy } from "@/lib/ui/types";
import { GrokOpinion } from "./GrokOpinion";

type Props = {
  vertical: VerticalConfig;
  phase: string;
  ranked: RankedDeal[];
  sessions: SessionCard[];
  onListen: (vendor_id: string, ts: number) => void;
  replay?: boolean;
  jobSpec?: Record<string, unknown> | null;
  dealReview?: DealReviewUi | null;
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

function formatTs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function DealColumn({
  vertical,
  phase,
  ranked,
  sessions,
  onListen,
  replay,
  jobSpec,
  dealReview,
}: Props) {
  const ready = phase === "complete" && ranked.length > 0;
  const copy = uiCopy(vertical);
  const benchKey =
    vertical.red_flag.benchmark_key || vertical.default_job_type || "";
  const bench = benchKey ? vertical.benchmarks[benchKey] : undefined;

  const exportReport = () => {
    const html = buildPrintableReport({
      vertical,
      ranked,
      sessions,
      jobSpec,
      bench,
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-3.5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="label-section !text-[var(--glass-text-muted)]">Your deal</p>
          <h2 className="mt-0.5 text-[17px] font-medium tracking-tight text-[var(--glass-text)]">
            {copy.deal_column_title}
          </h2>
          <p className="text-[13px] text-[var(--glass-text-secondary)]">
            Review layer ranks all three outcomes
          </p>
          {bench?.source && (
            <p
              className="mt-1 text-[10px] text-[var(--glass-text-muted)]"
              title={bench.source}
            >
              Fair band{" "}
              {bench.fair_low != null && bench.fair_high != null
                ? `$${bench.fair_low}–$${bench.fair_high}`
                : ""}
            </p>
          )}
        </div>
        {ready && (
          <button
            type="button"
            onClick={exportReport}
            className="btn-pill btn-pill-primary shrink-0 !px-3 !py-1.5 text-xs"
          >
            Export
          </button>
        )}
      </header>

      {!ready ? (
        <div className="glass-inner flex flex-1 flex-col items-center justify-center p-6 text-center">
          {phase === "calling" ? (
            <>
              <div className="mb-3 flex gap-1.5" aria-hidden>
                <span className="agent-activity-dot !bg-[var(--success)] !shadow-[0_0_8px_rgba(27,122,74,0.35)]" />
                <span className="agent-activity-dot !bg-[var(--success)] !shadow-[0_0_8px_rgba(27,122,74,0.35)]" />
                <span className="agent-activity-dot !bg-[var(--success)] !shadow-[0_0_8px_rgba(27,122,74,0.35)]" />
              </div>
              <p className="text-sm text-[var(--glass-text-secondary)]">
                Three agents negotiating in parallel.
                <br />
                Your deal appears when they finish.
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--glass-text-muted)]">
              Confirm your job to start simultaneous negotiations.
            </p>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-auto">
          {dealReview && <ReviewHero review={dealReview} />}
          {ranked.map((r) => (
            <DealCard
              key={r.session.vendor_id + r.rank}
              deal={r}
              vertical={vertical}
              onListen={onListen}
              replay={replay}
              fullSession={
                sessions.find((s) => s.vendor_id === r.session.vendor_id) ||
                r.session
              }
            />
          ))}
          <GrokOpinion
            reportJson={{
              vertical: vertical.id,
              deal_review: dealReview,
              ranked: ranked.map((r) => ({
                vendor: r.session.vendor_name,
                total: r.session.current_price,
                red_flag: r.red_flag,
                why: r.why,
              })),
            }}
          />
        </div>
      )}
    </section>
  );
}

function ReviewHero({ review }: { review: DealReviewUi }) {
  return (
    <article className="glass-inner p-4 ring-1 ring-white/25">
      <p className="label-section !text-[var(--glass-text-muted)]">Recommended</p>
      <h3 className="mt-1 text-lg font-medium leading-snug text-[var(--glass-text)]">
        {review.headline}
      </h3>
      {review.top_pick?.total != null && (
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[var(--ink)]">
          {formatUsd(review.top_pick.total)}
        </p>
      )}
      {review.top_pick && (
        <p className="mt-1 text-xs font-medium text-[var(--glass-text-secondary)]">
          {review.top_pick.label}
          {review.top_pick.red_flag ? " · flagged" : " · clean quote"}
        </p>
      )}

      <div className="mt-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--glass-text-muted)]">
          Why this one
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {review.why_top.map((line, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm leading-snug text-[var(--glass-text-secondary)]"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink-muted)]" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {review.how_others_compared.length > 0 && (
        <details className="mt-3 rounded-xl border border-white/15 bg-white/[0.06] p-2.5">
          <summary className="cursor-pointer text-xs font-medium text-[var(--glass-text)]">
            How the other two compared
          </summary>
          <ul className="mt-2 space-y-1.5 text-xs leading-snug text-[var(--glass-text-secondary)]">
            {review.how_others_compared.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="mt-2 rounded-xl border border-white/15 bg-white/[0.06] p-2.5">
        <summary className="cursor-pointer text-xs font-medium text-[var(--glass-text)]">
          How multi-agent negotiation worked
        </summary>
        <ul className="mt-2 space-y-1 text-xs text-[var(--glass-text-secondary)]">
          {review.how_we_negotiated.map((line, i) => (
            <li key={i}>• {line}</li>
          ))}
        </ul>
      </details>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-1.5 rounded-full bg-[var(--ink)]"
            style={{ width: `${Math.min(100, review.confidence)}%` }}
          />
        </div>
        <span className="text-[11px] tabular-nums text-[var(--glass-text-muted)]">
          {review.confidence}% confidence
        </span>
      </div>
    </article>
  );
}

function buildPrintableReport(input: {
  vertical: VerticalConfig;
  ranked: RankedDeal[];
  sessions: SessionCard[];
  jobSpec?: Record<string, unknown> | null;
  bench?: BenchmarkEntry;
}): string {
  const rows = input.ranked
    .map((r) => {
      const s = r.session;
      return `<tr>
        <td>${r.rank}</td>
        <td>${s.vendor_name}</td>
        <td>${s.current_price != null ? formatUsd(s.current_price) : s.outcome}</td>
        <td>${r.red_flag ? "BAIT RISK" : "—"}</td>
        <td>${r.why || ""}</td>
      </tr>`;
    })
    .join("");
  return `<!doctype html><html><head><title>LeverageAI Report</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}
    h1{font-size:20px} table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:13px}
    th{background:#f8fafc} .note{font-size:12px;color:#64748b;margin-top:12px}
    @media print{button{display:none}}
  </style></head><body>
  <h1>LeverageAI — quote report</h1>
  <p>Vertical: ${input.vertical.displayName || input.vertical.id}</p>
  <p>Job: ${JSON.stringify(input.jobSpec || {})}</p>
  ${
    input.bench?.source
      ? `<p class="note">Benchmark: ${input.bench.source}</p>`
      : ""
  }
  <table><thead><tr><th>#</th><th>Vendor</th><th>Total</th><th>Flags</th><th>Why</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p class="note">LeverageAI never promises the lowest price. Red-flagged quotes ≥30% below fair mid are warnings, not winners.</p>
  </body></html>`;
}

function DealCard({
  deal,
  vertical,
  onListen,
  fullSession,
  replay,
}: {
  deal: RankedDeal;
  vertical: VerticalConfig;
  onListen: (vendor_id: string, ts: number) => void;
  fullSession: SessionCard;
  replay?: boolean;
}) {
  const [open, setOpen] = useState(deal.recommended || deal.red_flag);
  const s = deal.session;
  const price = s.current_price;
  const chain = deal.leverage_chain || [];

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
      className={`glass-inner p-3.5 ${
        deal.recommended ? "ring-1 ring-white/35" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--glass-text-muted)]">
              #{deal.rank}
            </span>
            <h3 className="font-medium text-[var(--glass-text)]">
              {s.vendor_name}
            </h3>
            {deal.recommended && (
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[#0c0b0a]">
                Top pick
              </span>
            )}
          </div>
          {price != null ? (
            <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--ink)]">
              {formatUsd(price)}
            </p>
          ) : (
            <p className="mt-1 text-sm font-medium text-[var(--glass-text-secondary)]">
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
          className="text-xs font-medium text-[var(--glass-text-muted)] hover:text-[var(--glass-text)]"
        >
          {open ? "Hide" : "Details"}
        </button>
      </div>

      {deal.red_flag && deal.red_flag_pct != null && (
        <div className="mt-2 rounded-xl bg-[rgba(255,120,90,0.2)] px-3 py-2 text-xs font-medium text-[#ffc9b8] ring-1 ring-[rgba(255,140,110,0.3)]">
          {redBanner(vertical, deal.red_flag_pct)}
        </div>
      )}

      {deal.why && (
        <p className="mt-2 text-sm text-[var(--glass-text-secondary)]">{deal.why}</p>
      )}

      {s.callback_at && (
        <p className="mt-1 text-xs text-[var(--glass-text-muted)]">
          Callback: <span className="font-medium text-[var(--glass-text-secondary)]">{s.callback_at}</span>
        </p>
      )}

      {open && s.line_items?.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
          {s.line_items.map((li, i) => (
            <li
              key={`${li.label}-${i}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="text-[var(--glass-text-secondary)]">{li.label}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums font-medium text-[var(--ink)]">
                  {formatUsd(li.amount)}
                </span>
                {li.evidence_ts != null && (
                  <button
                    type="button"
                    onClick={() => onListen(s.vendor_id, li.evidence_ts!)}
                    className="text-[11px] font-medium text-[var(--ink)] underline-offset-2 hover:underline"
                  >
                    Listen
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open && chain.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/15 bg-white/[0.06] p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--glass-text-muted)]">
            Leverage chain
          </p>
          <ol className="mt-2 space-y-1.5">
            {chain.map((step, i) => (
              <li key={i} className="text-xs text-[var(--glass-text-secondary)]">
                <span className="font-mono text-[var(--glass-text-muted)]">
                  [t={formatTs(step.t_ms)}]
                </span>{" "}
                {step.label}
              </li>
            ))}
          </ol>
        </div>
      )}

      {open && (
        <p className="mt-2 text-xs text-[var(--glass-text-muted)]">
          {replay || !s.audio_url
            ? "Recording available in live mode — transcript shown."
            : "Live recording attached."}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={downloadTranscript}
          className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-[var(--glass-text)] hover:bg-white/18"
        >
          Download transcript
        </button>
        {s.audio_url ? (
          <audio controls src={s.audio_url} className="h-8 max-w-[200px]" />
        ) : (
          <button
            type="button"
            onClick={downloadAudio}
            disabled
            className="rounded-full border border-white/15 px-2.5 py-1.5 text-xs font-medium text-[var(--glass-text-muted)]"
          >
            Play audio (live only)
          </button>
        )}
      </div>
    </article>
  );
}
