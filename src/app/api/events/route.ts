import { NextRequest } from "next/server";
import { subscribe, type StoreEvent } from "@/lib/db/events";

/**
 * GET /api/events?job_id= — SSE stream of transcript + quote + session updates.
 *
 * IMPORTANT (serverless / multi-instance):
 * In-process pub/sub only notifies listeners on the *same* instance that
 * published. On Vercel Hobby this often means SSE is sparse or empty while
 * bridges run on another isolate.
 *
 * **Preferred live path for UI:** poll GET /api/jobs/{id}/state every ~1s.
 * That reads Neon (or memory) and is complete for transcripts, quotes,
 * deal_review, and session status. SSE is a best-effort acceleration only.
 *
 * Headers include polling_fallback so clients can self-document.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("job_id");
  if (!jobId) {
    return new Response(
      JSON.stringify({
        error: "job_id query param required",
        polling_fallback: "GET /api/jobs/{id}/state every 1s",
        note: "Neon poll is the reliable live path on multi-instance hosts",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const send = (data: unknown) => {
        safeEnqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      send({
        type: "connected",
        job_id: jobId,
        ts: Date.now(),
        polling_fallback: `/api/jobs/${jobId}/state`,
        note: "Poll state every 1s if SSE drops — Redis-free Neon poll is OK",
      });

      const onEvent = (event: StoreEvent) => {
        if (event.job_id !== jobId) return;
        send(event);
      };

      unsub = subscribe(onEvent);

      // Heartbeat keeps proxies from closing idle streams
      heartbeat = setInterval(() => {
        safeEnqueue(`: ping ${Date.now()}\n\n`);
        // Also emit a structured heartbeat event some clients parse
        send({
          type: "heartbeat",
          job_id: jobId,
          ts: Date.now(),
          polling_fallback: `/api/jobs/${jobId}/state`,
        });
      }, 12_000);

      const cleanup = () => {
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (unsub) unsub();
        unsub = null;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (unsub) unsub();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Polling-Fallback": `/api/jobs/${jobId}/state`,
    },
  });
}
