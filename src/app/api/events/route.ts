import { NextRequest } from "next/server";
import { subscribe, type StoreEvent } from "@/lib/db/events";

/**
 * GET /api/events?job_id= — SSE stream of transcript + quote + session updates.
 *
 * Fallback for clients that cannot use SSE: poll GET /api/jobs/[id]/state every 1s.
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
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  let unsub: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      send({
        type: "connected",
        job_id: jobId,
        ts: Date.now(),
        note: "Also poll GET /api/jobs/{id}/state every 1s if SSE drops",
      });

      const onEvent = (event: StoreEvent) => {
        if (event.job_id !== jobId) return;
        send(event);
      };

      unsub = subscribe(onEvent);

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // stream closed
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsub) unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsub) unsub();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
