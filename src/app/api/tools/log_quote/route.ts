import { NextRequest, NextResponse } from "next/server";
import { logQuote } from "@/lib/tools/logQuote";
import { getStore } from "@/lib/db";
import { publish } from "@/lib/db/events";

/**
 * POST /api/tools/log_quote
 * Server-side honesty: validates schema, session/job linkage, total vs line items, red_flag.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await logQuote(body);
    if (!result.ok) {
      const status =
        result.code === "SESSION_NOT_FOUND" || result.code === "JOB_NOT_FOUND"
          ? 404
          : 400;
      return NextResponse.json(result, { status });
    }

    const session = await getStore().getSession(result.quote.session_id);
    if (session) {
      publish({
        type: "quote",
        job_id: result.quote.job_id,
        session_id: result.quote.session_id,
        payload: result.quote,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    console.error("[POST /api/tools/log_quote]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
