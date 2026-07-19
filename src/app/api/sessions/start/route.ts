import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { waitUntil } from "@vercel/functions";
import { getStore } from "@/lib/db";
import { hasDatabaseUrl } from "@/lib/db/pool";
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
import { simulateJobNegotiations } from "@/lib/sessions/simulateNegotiation";

export const runtime = "nodejs";
/**
 * Vercel Hobby max is 300s; Pro/Fluid can raise further.
 * Background bridges / simulate use waitUntil — return is still instant.
 */
export const maxDuration = 300;

const schema = z.object({
  job_id: z.string().uuid(),
  /** True = ElevenLabs agent bridges (requires keys + DATABASE_URL). */
  live: z.boolean().optional(),
  /**
   * True = server-side scripted negotiation writing real DB rows (default when
   * live is not requested). Always works with Neon; best for live demos.
   */
  simulate: z.boolean().optional(),
});

function scheduleBackground(work: () => Promise<void>): void {
  const promise = work().catch((e) =>
    console.error("[sessions/start background]", e)
  );
  try {
    waitUntil(promise);
    return;
  } catch {
    /* not on Vercel */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require("next/server") as {
      after?: (fn: () => void | Promise<void>) => void;
    };
    if (typeof after === "function") {
      after(() => promise);
      return;
    }
  } catch {
    /* no after */
  }
  void promise;
}

/**
 * POST /api/sessions/start
 *
 * Modes:
 * - simulate (default): background script writes transcripts/quotes; UI polls.
 * - live=true: ElevenLabs text bridges (only if all agent env vars present).
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

    // Explicit live bridges only when live===true AND agents configured.
    // Otherwise default to server simulate (reliable for live pitch demos).
    const liveRequested = parsed.data.live === true;
    const liveAvailable = isLiveModeEnabled();
    let wantLive = liveRequested && liveAvailable;
    let wantSimulate =
      !wantLive &&
      (parsed.data.simulate === true ||
        parsed.data.live !== true ||
        !liveAvailable);

    // Serverless: both modes need shared Postgres so polling sees writes.
    if ((wantLive || wantSimulate) && !hasDatabaseUrl()) {
      return NextResponse.json(
        {
          error:
            "Live/simulate mode requires Postgres — in-memory store breaks across serverless instances. Set DATABASE_URL (Neon).",
          code: "DATABASE_REQUIRED_FOR_LIVE",
        },
        { status: 400 }
      );
    }

    if (liveRequested && !liveAvailable) {
      // Fall through to simulate with a clear flag
      wantLive = false;
      wantSimulate = true;
    }

    const existing = await store.listSessionsByJob(job.id);
    if (existing.length > 0) {
      const anyOutcome = existing.some((s) => s.outcome_type != null);
      const allDone =
        job.status === "complete" ||
        existing.every(
          (s) =>
            s.status === "closed" ||
            s.status === "error" ||
            s.outcome_type != null
        );
      // Re-kick simulate only if nothing has landed yet (crash before first outcome).
      const neverStarted = !anyOutcome && job.status === "running";
      if (neverStarted && wantSimulate && !wantLive) {
        const jobId = job.id;
        scheduleBackground(async () => {
          console.log(`[sessions/start] re-kick simulate job=${jobId}`);
          await simulateJobNegotiations(jobId);
        });
      }
      return NextResponse.json({
        sessions: existing,
        already_started: true,
        job_id: job.id,
        live: wantLive,
        simulate: wantSimulate && !wantLive,
        status: allDone
          ? "complete"
          : existing.some(
                (s) => s.status === "live" || s.status === "connecting"
              )
            ? wantLive
              ? "bridging"
              : "simulating"
            : neverStarted
              ? "simulating"
              : "ready",
        live_mode_available: liveAvailable,
        note:
          liveRequested && !liveAvailable
            ? "ElevenLabs agents not fully configured — using server simulate"
            : undefined,
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

    if (wantLive) {
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
          `[sessions/start] background bridges job=${jobId} n=${intents.length}`
        );
        try {
          const results = await runBridgesSequential(intents);
          console.log(
            `[sessions/start] bridges done`,
            results.map((r) => ({ id: r.sessionId, ok: r.ok, err: r.error }))
          );

          for (const r of results) {
            if (!r.ok) {
              publish({
                type: "session",
                job_id: jobId,
                session_id: r.sessionId,
                payload: {
                  status: "error",
                  event: "session_error",
                  reason: "bridge_error",
                  error: r.error,
                },
              });
              const storeE = getStore();
              const sess = await storeE.getSession(r.sessionId);
              if (sess && !sess.outcome_type) {
                await storeE.closeSession(
                  r.sessionId,
                  "documented_decline",
                  `bridge_error: ${r.error || "unknown"}`
                );
              }
            }
          }

          const store2 = getStore();
          for (const s of await store2.listSessionsByJob(jobId)) {
            if (s.negotiator_conversation_id) {
              await fetchAndStoreRecording(
                s.id,
                s.negotiator_conversation_id
              ).catch((e) =>
                console.warn("[sessions/start] recording", s.id, e)
              );
            }
          }

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
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[sessions/start] bridge fatal", msg);
          const storeE = getStore();
          for (const s of await storeE.listSessionsByJob(jobId)) {
            publish({
              type: "session",
              job_id: jobId,
              session_id: s.id,
              payload: {
                event: "session_error",
                reason: "bridge_error",
                error: msg,
              },
            });
            if (!s.outcome_type) {
              await storeE.closeSession(
                s.id,
                "documented_decline",
                `bridge_error: ${msg}`
              );
            }
          }
        }
      });
    } else if (wantSimulate) {
      for (const s of sessions) {
        await store.updateSession(s.id, { status: "connecting" });
        publish({
          type: "session",
          job_id: job.id,
          session_id: s.id,
          payload: { ...s, status: "connecting" },
        });
      }

      const jobId = job.id;
      scheduleBackground(async () => {
        console.log(`[sessions/start] background simulate job=${jobId}`);
        try {
          await simulateJobNegotiations(jobId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[sessions/start] simulate fatal", msg);
          const storeE = getStore();
          for (const s of await storeE.listSessionsByJob(jobId)) {
            if (!s.outcome_type) {
              await storeE.closeSession(
                s.id,
                "documented_decline",
                `simulate_error: ${msg}`
              );
            }
          }
          await storeE.updateJob(jobId, { status: "complete" });
        }
      });
    }

    const pub = toPublicVertical(vertical);
    const latest = await store.listSessionsByJob(job.id);

    return NextResponse.json(
      {
        job_id: job.id,
        sessions: latest,
        live: wantLive,
        simulate: wantSimulate && !wantLive,
        status: wantLive
          ? "bridging"
          : wantSimulate
            ? "simulating"
            : "ready",
        bridge_async: wantLive,
        simulate_async: wantSimulate && !wantLive,
        live_mode_available: liveAvailable,
        note:
          liveRequested && !liveAvailable
            ? "ElevenLabs agents not fully configured — using server simulate"
            : undefined,
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
