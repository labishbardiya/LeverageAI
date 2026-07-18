import { NextRequest, NextResponse } from "next/server";
import { logQuote } from "@/lib/tools/logQuote";
import { getStore } from "@/lib/db";
import { publish } from "@/lib/db/events";
import { recordToolCall } from "@/lib/tools/recordToolCall";
import { requireToolWebhookAuth } from "@/lib/security/webhookAuth";

/**
 * POST /api/tools/log_quote
 * Server-side honesty: validates schema, session/job linkage, total vs line items, red_flag.
 */
export async function POST(req: NextRequest) {
  const unauthorized = requireToolWebhookAuth(req);
  if (unauthorized) return unauthorized;
  try {
    const body = await req.json().catch(() => ({}));
    const b = body as Record<string, unknown>;
    const result = await logQuote(body);

    await recordToolCall({
      session_id: (b.session_id as string) || undefined,
      job_id: (b.job_id as string) || undefined,
      tool_name: "log_quote",
      payload: { request: b, result },
    });

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
