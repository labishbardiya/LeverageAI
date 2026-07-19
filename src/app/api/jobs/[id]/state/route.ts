import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import {
  getBenchmarkMid,
  isRedFlagTotal,
  loadVertical,
  type VerticalConfig,
} from "@/lib/config/loadVertical";
import { rankQuotes } from "@/lib/tools/rankQuotes";
import { buildLeverageChain } from "@/lib/tools/leverageChain";
import {
  buildDealReview,
  inferTotalFromTranscripts,
} from "@/lib/review/dealReview";
import {
  resolveJobTypeKey,
  type Job,
  type Quote,
  type RankedQuote,
  type Session,
} from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

function sessionTerminal(s: Session): boolean {
  return (
    s.status === "closed" ||
    s.status === "error" ||
    s.outcome_type != null
  );
}

/**
 * Merge: keep real quotes; for sessions still missing quotes, synthesize
 * lightweight quote-like rows from transcripts (response-local only).
 * Applies red_flag vs vertical benchmark when config is available.
 */
function synthesizeQuotesFromTranscripts(
  sessions: Session[],
  quotes: Quote[],
  transcripts: Parameters<typeof inferTotalFromTranscripts>[1],
  jobId: string,
  config?: VerticalConfig,
  job?: Job
): Quote[] {
  const covered = new Set(quotes.map((q) => q.session_id));
  const out: Quote[] = [...quotes];

  let mid: number | null = null;
  let threshold = 0.3;
  if (config && job) {
    try {
      const jobType = resolveJobTypeKey(job.job_spec, {
        default_job_type: config.default_job_type,
        benchmark_key: config.red_flag.benchmark_key,
      });
      mid = getBenchmarkMid(config, jobType);
      threshold = config.red_flag.threshold_below_benchmark ?? 0.3;
    } catch {
      mid = null;
    }
  }

  for (const s of sessions) {
    if (covered.has(s.id)) continue;
    if (
      s.outcome_type === "documented_decline" ||
      s.outcome_type === "callback_commitment"
    ) {
      continue;
    }
    const total =
      s.current_total ?? inferTotalFromTranscripts(s.id, transcripts);
    if (total == null) continue;

    let red_flag = false;
    if (mid != null) {
      red_flag = isRedFlagTotal(total, mid, threshold);
    }

    out.push({
      id: `synth-${s.id}`,
      session_id: s.id,
      job_id: jobId,
      vendor_id: s.vendor_id,
      line_items: [{ label: "Spoken total (transcript)", amount: total }],
      total,
      red_flag,
      notes: "synthesized from transcript for deal review",
      created_at: new Date().toISOString(),
    });
  }
  return out;
}

/**
 * GET /api/jobs/[id]/state — full state for UI polling (Redis-free).
 * Prefer this every ~1s as SSE backup on multi-instance serverless.
 * Produces deal_review when all sessions closed/error/have outcomes or job complete.
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const job = await store.getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const [sessions, quotesRaw, transcripts, tool_calls] = await Promise.all([
      store.listSessionsByJob(id),
      store.listQuotesByJob(id),
      store.listTranscriptsByJob(id, 300),
      store.listToolCallsByJob(id),
    ]);

    let config: VerticalConfig | undefined;
    try {
      config = loadVertical(job.vertical);
    } catch {
      config = undefined;
    }

    const allTerminal =
      sessions.length > 0 && sessions.every(sessionTerminal);
    const shouldReview =
      job.status === "complete" ||
      allTerminal ||
      (sessions.length > 0 &&
        sessions.every(
          (s) =>
            s.outcome_type != null ||
            s.status === "closed" ||
            s.status === "error"
        ));

    // Merge: even when quotesRaw is partial, synthesize missing sessions
    const quotes = shouldReview
      ? synthesizeQuotesFromTranscripts(
          sessions,
          quotesRaw,
          transcripts,
          id,
          config,
          job
        )
      : quotesRaw;

    const ranked: RankedQuote[] = rankQuotes(quotes, config, sessions).map(
      (r) => ({
        ...r,
        leverage_chain: buildLeverageChain({
          session_id: r.session_id,
          quotes,
          tool_calls,
          transcripts,
        }),
      })
    );

    const sessionsEnriched = sessions.map((s) => ({
      ...s,
      competing_bid_used: tool_calls.some(
        (t) =>
          t.session_id === s.id && t.tool_name === "get_competing_bids"
      ),
      // Surface inferred total for UI if session has none
      current_total:
        s.current_total ??
        (shouldReview
          ? inferTotalFromTranscripts(s.id, transcripts)
          : null) ??
        s.current_total,
    }));

    const deal_review = shouldReview
      ? buildDealReview({
          job,
          sessions,
          quotes,
          ranked,
          transcripts,
          tool_calls,
        })
      : null;

    return NextResponse.json({
      job,
      sessions: sessionsEnriched,
      quotes: quotesRaw, // real DB quotes only for quote list
      quotes_for_ranking:
        quotes.length !== quotesRaw.length ? quotes : undefined,
      transcripts,
      tool_calls,
      ranked,
      deal_review,
      all_sessions_terminal: allTerminal,
      polling_ok: true,
      backend: store.backend,
    });
  } catch (e) {
    console.error("[GET /api/jobs/:id/state]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
