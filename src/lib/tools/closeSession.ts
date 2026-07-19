/**
 * close_session — every call terminates in exactly one structured outcome.
 * Aliases: outcome_type | outcome ; callback_window | callback_at
 */
import { z } from "zod";
import { getStore } from "@/lib/db";
import type { Session } from "@/lib/types";
import { loadVertical } from "@/lib/config/loadVertical";
import { assessQuoteCompleteness } from "@/lib/review/quoteEvidence";

export const OUTCOME_TYPES = [
  "itemized_quote",
  "callback_commitment",
  "documented_decline",
] as const;

export const closeSessionSchema = z.object({
  session_id: z.string().uuid(),
  job_id: z.string().uuid().optional(),
  outcome_type: z.enum(OUTCOME_TYPES),
  callback_window: z.string().optional(),
  summary: z.string().optional(),
});

function normalizeBody(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const b = raw as Record<string, unknown>;
  const outcome_type =
    (b.outcome_type as string | undefined) ??
    (b.outcome as string | undefined);
  const callback_window =
    (b.callback_window as string | undefined) ??
    (b.callback_at as string | undefined) ??
    (typeof b.summary === "string" &&
    (outcome_type === "documented_decline" ||
      outcome_type === "callback_commitment")
      ? (b.summary as string)
      : undefined);

  return {
    session_id: b.session_id,
    job_id: b.job_id,
    outcome_type,
    callback_window,
    summary: b.summary,
  };
}

export type CloseSessionResult =
  | { ok: true; session: Session }
  | { ok: false; error: string; code: string };

export async function closeSession(raw: unknown): Promise<CloseSessionResult> {
  const parsed = closeSessionSchema.safeParse(normalizeBody(raw));
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  let { outcome_type } = parsed.data;
  const { session_id, job_id, callback_window, summary } =
    parsed.data;
  const store = getStore();

  const existing = await store.getSession(session_id);
  if (!existing) {
    return {
      ok: false,
      code: "SESSION_NOT_FOUND",
      error: "Session does not exist",
    };
  }

  // Idempotent: never overwrite a terminal outcome
  if (existing.outcome_type != null || existing.status === "closed") {
    return { ok: true, session: existing };
  }

  if (job_id && existing.job_id !== job_id) {
    return {
      ok: false,
      code: "JOB_MISMATCH",
      error: "job_id does not match session",
    };
  }

  // The challenge's stonewaller track is a documented refusal with the offered
  // callback preserved as evidence, not a successful price outcome.
  if (existing.vendor_id === "stonewaller") {
    outcome_type = "documented_decline";
  }

  if (outcome_type === "itemized_quote") {
    const quotes = await store.listQuotesByJob(existing.job_id);
    const sessionQuotes = quotes.filter((q) => q.session_id === session_id);
    const latest = sessionQuotes.at(-1);
    if (!latest) {
      return {
        ok: false,
        code: "MISSING_QUOTE",
        error:
          "Cannot close as itemized_quote without a logged quote for this session",
      };
    }
    const job = await store.getJob(existing.job_id);
    if (!job) {
      return { ok: false, code: "JOB_NOT_FOUND", error: "Job does not exist" };
    }
    const completeness = assessQuoteCompleteness(
      loadVertical(job.vertical),
      latest.line_items,
    );
    if (!completeness.itemized) {
      return {
        ok: false,
        code: "ITEMIZATION_INCOMPLETE",
        error: `Cannot close as itemized_quote; missing required categories: ${completeness.missing_required.join(", ") || "at least two distinct line items"}`,
      };
    }
  }

  // Persist callback window; fall back to summary for decline/callback
  const window =
    callback_window ??
    (outcome_type !== "itemized_quote" ? summary : undefined) ??
    null;

  const session = await store.closeSession(session_id, outcome_type, window);

  if (!session) {
    return {
      ok: false,
      code: "CLOSE_FAILED",
      error: "Failed to close session",
    };
  }

  // Persist learning before returning. It is still non-critical, but awaiting
  // it prevents serverless teardown from silently dropping observations.
  try {
    const job = await store.getJob(session.job_id);
    if (job) {
      try {
        const { onSessionClosed } = await import("@/lib/orchestrator/runtime");
        onSessionClosed(session.job_id);
      } catch {
        /* state-machine telemetry is optional */
      }
      const transcripts = await store.listTranscriptsBySession(session_id);
      const quotes = await store.listQuotesByJob(session.job_id);
      const priceHistory = quotes
        .filter((quote) => quote.session_id === session_id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((quote) => quote.total)
        .filter((total): total is number => typeof total === "number");
      const { extractLearningsFromSession } = await import(
        "@/lib/learning/extract"
      );
      await extractLearningsFromSession({
        vertical: job.vertical,
        transcripts: transcripts.map((event) => ({
          speaker: event.speaker,
          text: event.text,
          ts_ms: event.ts_ms,
        })),
        priceHistory,
      });
    }
  } catch (error) {
    console.warn("[closeSession] learning update failed", error);
  }

  return { ok: true, session };
}
