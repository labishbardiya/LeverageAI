import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { publish } from "@/lib/db/events";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  ts_ms: z.number().int().nonnegative().default(0),
  speaker: z.string().min(1),
  text: z.string().min(1),
});

/**
 * POST /api/sessions/[id]/transcript — append transcript event
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id: session_id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const store = getStore();
    const session = await store.getSession(session_id);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Auto-flip to live on first transcript
    if (session.status === "pending" || session.status === "connecting") {
      await store.updateSession(session_id, { status: "live" });
    }

    const event = await store.appendTranscript({
      session_id,
      ts_ms: parsed.data.ts_ms,
      speaker: parsed.data.speaker,
      text: parsed.data.text,
    });

    publish({
      type: "transcript",
      job_id: session.job_id,
      session_id,
      payload: event,
    });

    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    console.error("[POST /api/sessions/:id/transcript]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
