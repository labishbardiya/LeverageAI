import { NextRequest, NextResponse } from "next/server";
import { lookupBenchmark } from "@/lib/tools/lookupBenchmark";
import { recordToolCall } from "@/lib/tools/recordToolCall";

/**
 * POST /api/tools/lookup_benchmark
 * Benchmark ranges from /config/verticals only — includes source citation.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const b = body as Record<string, unknown>;
    const result = await lookupBenchmark(body);

    await recordToolCall({
      session_id: (b.session_id as string) || undefined,
      job_id: (b.job_id as string) || undefined,
      tool_name: "lookup_benchmark",
      payload: { request: b, result },
    });

    if (!result.ok) {
      const status = result.code === "JOB_NOT_FOUND" ? 404 : 400;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/tools/lookup_benchmark]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
