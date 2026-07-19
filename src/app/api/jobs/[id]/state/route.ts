import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { loadVertical } from "@/lib/config/loadVertical";
import { rankQuotes } from "@/lib/tools/rankQuotes";
import { buildLeverageChain } from "@/lib/tools/leverageChain";
import { buildDealReview } from "@/lib/review/dealReview";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/state — full state for UI polling
 * Includes deal_review (review layer over multi-agent outcomes).
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const job = await store.getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const [sessions, quotes, transcripts, tool_calls] = await Promise.all([
      store.listSessionsByJob(id),
      store.listQuotesByJob(id),
      store.listTranscriptsByJob(id, 300),
      store.listToolCallsByJob(id),
    ]);

    let config;
    try {
      config = loadVertical(job.vertical);
    } catch {
      config = undefined;
    }

    const ranked = rankQuotes(quotes, config, sessions).map((r) => ({
      ...r,
      leverage_chain: buildLeverageChain({
        session_id: r.session_id,
        quotes,
        tool_calls,
        transcripts,
      }),
    }));

    const deal_review =
      job.status === "complete" ||
      sessions.every((s) => s.outcome_type != null)
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
      sessions,
      quotes,
      transcripts,
      tool_calls,
      ranked,
      deal_review,
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
