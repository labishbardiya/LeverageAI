import { NextRequest, NextResponse } from "next/server";
import { lookupBenchmark } from "@/lib/tools/lookupBenchmark";

/**
 * POST /api/tools/lookup_benchmark
 * Benchmark ranges from /config/verticals only.
 * Body: { job_id } and/or { vertical, item }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await lookupBenchmark(body);
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
