/**
 * Review layer — evaluates all vendor sessions after multi-agent negotiation
 * and produces a single recommended deal with plain-language reasoning.
 *
 * Deterministic (no paid LLM): always works in live demos.
 * Fallback: if tools missed logging but transcripts have prices, still produce
 * a deal from parsed totals when sessions are terminal.
 */
import type {
  Job,
  Quote,
  RankedQuote,
  Session,
  TranscriptEvent,
  ToolCallRecord,
} from "@/lib/types";
import {
  getBenchmarkMid,
  loadVertical,
  type VerticalConfig,
} from "@/lib/config/loadVertical";
import { resolveJobTypeKey } from "@/lib/types";
import { buildLeverageChain } from "@/lib/tools/leverageChain";

export type DealReviewVerdict = {
  vendor_id: string;
  vendor_name: string;
  total: number | null;
  outcome: string | null;
  red_flag: boolean;
  red_flag_pct?: number;
  /** Short label for the card */
  label: string;
  /** One plain sentence for a homeowner */
  plain: string;
};

export type DealReview = {
  /** Human headline e.g. "We recommend Summit Air at $7,875" */
  headline: string;
  /** Top pick only */
  top_pick: DealReviewVerdict | null;
  /** Why #1 in everyday language (2–4 short sentences) */
  why_top: string[];
  /** How others compared — easy bullets */
  how_others_compared: string[];
  /** What we did as agents (orchestration summary) */
  how_we_negotiated: string[];
  /** Confidence 0–100 for UI meter */
  confidence: number;
  /** Full ordered verdicts for UI */
  verdicts: DealReviewVerdict[];
  generated_at: string;
  /** True when totals came from transcript parse, not log_quote */
  from_transcript_fallback?: boolean;
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function pctBelow(mid: number, total: number): number {
  if (mid <= 0) return 0;
  return Math.round(((mid - total) / mid) * 100);
}

/** Parse $ amounts from free text (bridge / live without tool webhooks). */
export function parsePricesFromTranscriptText(text: string): number[] {
  const out: number[] = [];
  const re =
    /\$\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = (m[1] || m[2] || "").replace(/,/g, "");
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 50 && n <= 500_000) out.push(Math.round(n));
  }
  return out;
}

/**
 * Best spoken total for a session when quotes are missing.
 * Prefers last vendor-spoken price (itemized final, not teaser min).
 */
export function inferTotalFromTranscripts(
  sessionId: string,
  transcripts: TranscriptEvent[]
): number | null {
  const lines = transcripts
    .filter((t) => t.session_id === sessionId)
    .sort((a, b) => a.ts_ms - b.ts_ms);

  let lastVendor: number | null = null;
  let lastAny: number | null = null;
  for (const line of lines) {
    const prices = parsePricesFromTranscriptText(line.text);
    if (!prices.length) continue;
    // Last $ in the line is usually the revised/all-in figure
    const n = prices[prices.length - 1]!;
    lastAny = n;
    if (line.speaker === "vendor" || line.speaker === "agent") {
      lastVendor = n;
    }
  }
  return lastVendor ?? lastAny;
}

/**
 * Build layman-friendly deal review from completed multi-agent run.
 */
export function buildDealReview(input: {
  job: Job;
  sessions: Session[];
  quotes: Quote[];
  ranked: RankedQuote[];
  transcripts?: TranscriptEvent[];
  tool_calls?: ToolCallRecord[];
}): DealReview {
  let vertical: VerticalConfig | null = null;
  try {
    vertical = loadVertical(input.job.vertical);
  } catch {
    vertical = null;
  }

  const jobType = resolveJobTypeKey(input.job.job_spec, {
    default_job_type: vertical?.default_job_type,
    benchmark_key: vertical?.red_flag.benchmark_key,
  });
  const mid =
    vertical && jobType
      ? getBenchmarkMid(vertical, jobType)
      : vertical
        ? getBenchmarkMid(
            vertical,
            vertical.default_job_type ||
              Object.keys(vertical.benchmarks)[0] ||
              ""
          )
        : null;

  const thrPct = vertical
    ? Math.round((vertical.red_flag.threshold_below_benchmark || 0.3) * 100)
    : 30;
  const thrFrac = vertical?.red_flag.threshold_below_benchmark ?? 0.3;

  // Latest quote per session
  const latestBySession = new Map<string, Quote>();
  for (const q of input.quotes) {
    const prev = latestBySession.get(q.session_id);
    if (!prev || prev.created_at <= q.created_at) {
      latestBySession.set(q.session_id, q);
    }
  }

  let usedTranscriptFallback = false;

  const totalsBySession = new Map<string, number | null>();
  for (const s of input.sessions) {
    const q = latestBySession.get(s.id);
    let total = s.current_total ?? q?.total ?? null;
    if (total == null && input.transcripts?.length) {
      const inferred = inferTotalFromTranscripts(s.id, input.transcripts);
      if (inferred != null) {
        total = inferred;
        usedTranscriptFallback = true;
      }
    }
    totalsBySession.set(s.id, total);
  }

  const verdicts: DealReviewVerdict[] = input.sessions.map((s) => {
    const q = latestBySession.get(s.id);
    const total = totalsBySession.get(s.id) ?? null;
    let red = Boolean(q?.red_flag);
    if (!red && mid != null && total != null && total < mid * (1 - thrFrac)) {
      red = true;
    }
    const rfPct =
      mid != null && total != null && total < mid
        ? pctBelow(mid, total)
        : undefined;

    let label = "No firm quote";
    let plain = `${s.vendor_name} did not give a full itemized price on the call.`;

    if (s.outcome_type === "documented_decline") {
      label = "Would not quote by phone";
      plain = `${s.vendor_name} refused a firm phone price${
        s.callback_window ? ` — callback: ${s.callback_window}` : ""
      }.`;
    } else if (s.outcome_type === "callback_commitment") {
      label = "Callback only";
      plain = `${s.vendor_name} committed to call back${
        s.callback_window ? ` (${s.callback_window})` : ""
      } — no installed total yet.`;
    } else if (total != null && red) {
      label = "Too cheap to trust alone";
      plain = `${s.vendor_name} at ${formatUsd(total)} (~${
        rfPct ?? thrPct
      }% under market mid${mid != null ? ` ${formatUsd(mid)}` : ""}). Bait risk.`;
    } else if (total != null) {
      label = q ? "Clean itemized quote" : "Spoken total (parsed)";
      plain = `${s.vendor_name}: ${formatUsd(total)}${
        mid != null ? ` (fair mid ~${formatUsd(mid)})` : ""
      }.`;
    }

    return {
      vendor_id: s.vendor_id,
      vendor_name: s.vendor_name,
      total,
      outcome: s.outcome_type,
      red_flag: red,
      red_flag_pct: rfPct,
      label,
      plain,
    };
  });

  // Winner from ranked (is_winner) or first non-red with a total
  const winnerRanked = input.ranked.find((r) => r.is_winner && !r.red_flag);
  let winnerSession = winnerRanked
    ? input.sessions.find((s) => s.id === winnerRanked.session_id)
    : undefined;

  if (!winnerSession) {
    const candidates = input.sessions
      .map((s) => ({
        s,
        total: totalsBySession.get(s.id),
        red: verdicts.find((v) => v.vendor_id === s.vendor_id)?.red_flag,
      }))
      .filter(
        (c) =>
          c.total != null &&
          !c.red &&
          c.s.outcome_type !== "documented_decline" &&
          c.s.outcome_type !== "callback_commitment"
      )
      .sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
    winnerSession = candidates[0]?.s;

    // If all itemized are red, still pick lowest non-callback as informative (not ideal)
    if (!winnerSession) {
      const anyPriced = input.sessions
        .map((s) => ({ s, total: totalsBySession.get(s.id) }))
        .filter(
          (c) =>
            c.total != null &&
            c.s.outcome_type !== "documented_decline" &&
            c.s.outcome_type !== "callback_commitment"
        )
        .sort((a, b) => (a.total ?? 0) - (b.total ?? 0));
      // Prefer non-red; if none, leave null top_pick
      const nonRed = anyPriced.filter(
        (c) => !verdicts.find((v) => v.vendor_id === c.s.vendor_id)?.red_flag
      );
      winnerSession = nonRed[0]?.s;
    }
  }

  const top_pick = winnerSession
    ? verdicts.find((v) => v.vendor_id === winnerSession!.vendor_id) ?? null
    : null;

  const why_top: string[] = [];
  if (top_pick && top_pick.total != null) {
    why_top.push(
      `${top_pick.vendor_name} at ${formatUsd(top_pick.total)} — best clean total.`
    );
    if (mid != null) {
      why_top.push(`Near market mid (~${formatUsd(mid)}), not a bait teaser.`);
    }
    if (winnerSession) {
      const chain = buildLeverageChain({
        session_id: winnerSession.id,
        quotes: input.quotes,
        tool_calls: input.tool_calls || [],
        transcripts: input.transcripts || [],
      });
      if (chain.some((c) => c.kind === "get_competing_bids")) {
        why_top.push("Price moved after a real competing bid from this job.");
      }
    }
  } else {
    why_top.push("No clean winner — check callbacks or re-run.");
  }

  const how_others_compared = verdicts
    .filter((v) => !top_pick || v.vendor_id !== top_pick.vendor_id)
    .map((v) => {
      if (v.red_flag && v.total != null) {
        return `${v.vendor_name}: ${formatUsd(v.total)} — under market (fee risk).`;
      }
      if (
        v.outcome === "documented_decline" ||
        v.outcome === "callback_commitment"
      ) {
        return `${v.vendor_name}: no firm phone price.`;
      }
      if (v.total != null) return `${v.vendor_name}: ${formatUsd(v.total)}.`;
      return `${v.vendor_name}: no quote.`;
    });

  const how_we_negotiated = [
    "Three agents negotiated in parallel.",
    "Only full itemized (or spoken firm) totals rank; bait prices don't win.",
  ];
  if (usedTranscriptFallback) {
    how_we_negotiated.push(
      "Some totals recovered from call transcripts when tools did not log."
    );
  }

  let confidence = 40;
  const closed = input.sessions.filter(
    (s) =>
      s.outcome_type ||
      s.status === "closed" ||
      s.status === "error"
  ).length;
  confidence += closed * 12;
  if (top_pick) confidence += 20;
  if (top_pick && !top_pick.red_flag) confidence += 10;
  if (input.tool_calls?.some((t) => t.tool_name === "get_competing_bids")) {
    confidence += 8;
  }
  if (usedTranscriptFallback) confidence -= 12;
  confidence = Math.min(96, Math.max(25, confidence));

  const headline = top_pick
    ? top_pick.total != null
      ? `Recommended: ${top_pick.vendor_name} at ${formatUsd(top_pick.total)}`
      : `Recommended: ${top_pick.vendor_name}`
    : "No single recommended deal yet";

  return {
    headline,
    top_pick,
    why_top,
    how_others_compared,
    how_we_negotiated,
    confidence,
    verdicts,
    generated_at: new Date().toISOString(),
    from_transcript_fallback: usedTranscriptFallback || undefined,
  };
}
