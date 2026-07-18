import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { loadVertical } from "@/lib/config/loadVertical";
import { rankQuotes } from "@/lib/tools/rankQuotes";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/state — full state for UI polling (job, sessions, quotes, transcripts, ranked)
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const job = await store.getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const [sessions, quotes, transcripts] = await Promise.all([
      store.listSessionsByJob(id),
      store.listQuotesByJob(id),
      store.listTranscriptsByJob(id, 300),
    ]);

    let config;
    try {
      config = loadVertical(job.vertical);
    } catch {
      config = undefined;
    }

    const ranked = rankQuotes(quotes, config, sessions);

    return NextResponse.json({
      job,
      sessions,
      quotes,
      transcripts,
      ranked,
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
