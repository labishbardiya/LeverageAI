import { NextRequest, NextResponse } from "next/server";
import { closeSession } from "@/lib/tools/closeSession";
import { publish } from "@/lib/db/events";
import { recordToolCall } from "@/lib/tools/recordToolCall";

/**
 * POST /api/tools/close_session
 * outcome_type ∈ itemized_quote | callback_commitment | documented_decline
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const b = body as Record<string, unknown>;
    const result = await closeSession(body);

    await recordToolCall({
      session_id: (b.session_id as string) || undefined,
      job_id: (b.job_id as string) || undefined,
      tool_name: "close_session",
      payload: { request: b, result },
    });

    if (!result.ok) {
      const status = result.code === "SESSION_NOT_FOUND" ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    publish({
      type: "session",
      job_id: result.session.job_id,
      session_id: result.session.id,
      payload: result.session,
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[POST /api/tools/close_session]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
