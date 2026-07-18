import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import {
  loadVertical,
  toPublicVertical,
} from "@/lib/config/loadVertical";
import { publish } from "@/lib/db/events";
import { isLiveModeEnabled } from "@/lib/elevenlabs/liveMode";
import { getAgentId } from "@/lib/elevenlabs/env";
import { runBridgesSequential } from "@/lib/elevenlabs/bridge";
import type { BridgePairIntent } from "@/lib/elevenlabs/types";
import { fetchAndStoreRecording } from "@/lib/elevenlabs/recordings";

export const runtime = "nodejs";
/** Vercel / Fluid: allow long background bridges when platform supports it */
export const maxDuration = 300;

const schema = z.object({
  job_id: z.string().uuid(),
  /** When true and live mode is on, start bridges (default true). */
  live: z.boolean().optional(),
});

/**
 * Schedule work that may outlive the HTTP response.
 * - Prefer Next.js `after()` when available
 * - Else Vercel `waitUntil`
 * - Else fire-and-forget (localhost / long-lived Node)
 */
function scheduleBackground(work: () => Promise<void>): void {
  const task = () =>
    work().catch((e) => console.error("[sessions/start background]", e));

  try {
    // next/server after() — Next 15+
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require("next/server") as {
      after?: (fn: () => void | Promise<void>) => void;
    };
    if (typeof after === "function") {
      after(task);
      return;
    }
  } catch {
    /* no after */
  }

  try {
    // @vercel/functions waitUntil — optional dependency
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@vercel/functions") as {
      waitUntil?: (p: Promise<unknown>) => void;
    };
    if (typeof mod.waitUntil === "function") {
      mod.waitUntil(task());
      return;
    }
  } catch {
    /* no vercel functions */
  }

  // Localhost / ngrok: Node process stays up
  void task();
}

/**
 * POST /api/sessions/start — create 3 sessions from config vendors.
 *
 * Live mode: returns immediately with status "bridging" and runs
 * sequential WebSocket bridges in the background. UI polls/SSE for updates.
 * Scaffold / replay: no bridges (same as before).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const store = getStore();
    const job = await store.getJob(parsed.data.job_id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!job.confirmed) {
      return NextResponse.json(
        { error: "Job must be confirmed before starting sessions" },
        { status: 400 }
      );
    }

    const existing = await store.listSessionsByJob(job.id);
    if (existing.length > 0) {
      return NextResponse.json({
        sessions: existing,
        already_started: true,
        job_id: job.id,
        live: isLiveModeEnabled(),
        status: existing.some((s) => s.status === "live" || s.status === "connecting")
          ? "bridging"
          : "ready",
      });
    }

    let vertical;
    try {
      vertical = loadVertical(job.vertical);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Vertical error" },
        { status: 400 }
      );
    }

    const frozen = job.frozen_job_spec ?? job.job_spec;
    const jobSpecJson = JSON.stringify(frozen);

    const sessions = [];
    for (const vendor of vertical.vendors) {
      const session = await store.createSession({
        job_id: job.id,
        vendor_id: vendor.id,
        vendor_name: vendor.name ?? vendor.displayName,
        status: "pending",
      });
      sessions.push(session);
      publish({
        type: "session",
        job_id: job.id,
        session_id: session.id,
        payload: session,
      });
    }

    await store.updateJob(job.id, { status: "running" });

    const live = isLiveModeEnabled() && parsed.data.live !== false;

    if (live) {
      // Mark pending sessions as connecting before response returns
      for (const s of sessions) {
        await store.updateSession(s.id, { status: "connecting" });
        publish({
          type: "session",
          job_id: job.id,
          session_id: s.id,
          payload: { ...s, status: "connecting" },
        });
      }

      const intents: BridgePairIntent[] = sessions.map((s) => {
        const slot = s.vendor_id as "tough" | "stonewaller" | "upseller";
        return {
          negotiatorAgentId: getAgentId("negotiator"),
          counterAgentId: getAgentId(slot),
          companyKey: slot,
          jobId: job.id,
          sessionId: s.id,
          jobSpecJson,
        };
      });

      const jobId = job.id;
      scheduleBackground(async () => {
        console.log(
          `[sessions/start] background bridges for job ${jobId} (${intents.length} sequential)`
        );
        const results = await runBridgesSequential(intents);
        console.log(
          `[sessions/start] bridges done job=${jobId}`,
          results.map((r) => ({ session: r.sessionId, ok: r.ok, err: r.error }))
        );

        // Best-effort recordings after each bridge closes
        const store2 = getStore();
        for (const s of await store2.listSessionsByJob(jobId)) {
          if (s.negotiator_conversation_id) {
            await fetchAndStoreRecording(
              s.id,
              s.negotiator_conversation_id
            ).catch((e) =>
              console.warn("[sessions/start] recording failed", s.id, e)
            );
          }
        }

        // Mark job complete when all sessions closed/errored
        const finalSessions = await store2.listSessionsByJob(jobId);
        const allDone = finalSessions.every(
          (s) =>
            s.status === "closed" ||
            s.status === "error" ||
            s.outcome_type != null
        );
        if (allDone) {
          await store2.updateJob(jobId, { status: "complete" });
          publish({
            type: "job",
            job_id: jobId,
            payload: { status: "complete" },
          });
        }
      });
    }

    const pub = toPublicVertical(vertical);
    const latest = await store.listSessionsByJob(job.id);

    return NextResponse.json(
      {
        job_id: job.id,
        sessions: latest,
        live,
        status: live ? "bridging" : "ready",
        /** Bridges run in background when live — poll /api/jobs/:id/state or SSE */
        bridge_async: live,
        vendors: pub.vendors.map((v) => ({
          id: v.id,
          name: v.name ?? v.displayName,
          displayName: v.displayName,
          persona: v.persona ?? v.role,
          role: v.role,
          role_label: v.role_label,
          public_blurb: v.public_blurb,
        })),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[POST /api/sessions/start]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
