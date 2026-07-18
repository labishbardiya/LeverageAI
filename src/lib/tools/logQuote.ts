/**
 * log_quote — server-side honesty gate.
 * Accepts both internal names and ElevenLabs tool-schema aliases:
 *   vendor_id | company_key
 *   total | grand_total
 *   line_items as array or JSON string
 */
import { z } from "zod";
import { getStore } from "@/lib/db";
import {
  getBenchmarkMid,
  isRedFlagTotal,
  loadVertical,
} from "@/lib/config/loadVertical";
import { resolveJobTypeKey, type Quote } from "@/lib/types";

const lineItemSchema = z.object({
  label: z.string().min(1),
  amount: z.number().finite(),
  optional: z.boolean().optional(),
});

function coerceLineItems(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

/** Normalize ElevenLabs / internal field names into a single shape */
function normalizeBody(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const b = raw as Record<string, unknown>;
  const line_items = coerceLineItems(b.line_items);
  const vendor_id =
    (b.vendor_id as string | undefined) ??
    (b.company_key as string | undefined);
  const total =
    (b.total as number | undefined) ??
    (b.grand_total as number | undefined);

  return {
    session_id: b.session_id,
    job_id: b.job_id,
    vendor_id,
    line_items,
    total,
    notes: b.notes,
    // accepted but unused for storage (session already has vendor_name)
    company_name: b.company_name,
    currency: b.currency,
    is_update: b.is_update,
  };
}

export const logQuoteSchema = z.object({
  session_id: z.string().uuid(),
  job_id: z.string().uuid(),
  vendor_id: z.string().min(1),
  line_items: z
    .array(lineItemSchema)
    .min(1, "line_items must not be empty for itemized quote"),
  total: z.number().finite(),
  notes: z.string().optional(),
  company_name: z.string().optional(),
  currency: z.string().optional(),
  is_update: z.boolean().optional(),
});

export type LogQuoteBody = z.infer<typeof logQuoteSchema>;

export type LogQuoteResult =
  | { ok: true; quote: Quote }
  | { ok: false; error: string; code: string };

const TOTAL_TOLERANCE = 1; // dollars

export async function logQuote(raw: unknown): Promise<LogQuoteResult> {
  const parsed = logQuoteSchema.safeParse(normalizeBody(raw));
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  const input = parsed.data;
  const store = getStore();

  const session = await store.getSession(input.session_id);
  if (!session) {
    return {
      ok: false,
      code: "SESSION_NOT_FOUND",
      error: "Session does not exist",
    };
  }

  if (session.job_id !== input.job_id) {
    return {
      ok: false,
      code: "JOB_MISMATCH",
      error: "job_id does not match session",
    };
  }

  const job = await store.getJob(input.job_id);
  if (!job) {
    return {
      ok: false,
      code: "JOB_NOT_FOUND",
      error: "Job does not exist",
    };
  }

  if (input.vendor_id !== session.vendor_id) {
    return {
      ok: false,
      code: "VENDOR_MISMATCH",
      error: "vendor_id/company_key does not match session vendor",
    };
  }

  for (const li of input.line_items) {
    if (typeof li.amount !== "number" || !Number.isFinite(li.amount)) {
      return {
        ok: false,
        code: "INVALID_AMOUNT",
        error: `line_item "${li.label}" has non-numeric amount`,
      };
    }
  }

  const sum = input.line_items.reduce((acc, li) => acc + li.amount, 0);
  if (Math.abs(sum - input.total) > TOTAL_TOLERANCE) {
    return {
      ok: false,
      code: "TOTAL_MISMATCH",
      error: `total ${input.total} does not match line_items sum ${sum} (tolerance $${TOTAL_TOLERANCE})`,
    };
  }

  // Red-flag from config only (threshold_below_benchmark, never hardcode 0.30)
  let red_flag = false;
  try {
    const vertical = loadVertical(job.vertical);
    const jobType = resolveJobTypeKey(job.job_spec, {
      default_job_type: vertical.default_job_type,
      benchmark_key: vertical.red_flag.benchmark_key,
    });
    const mid = getBenchmarkMid(vertical, jobType);
    if (mid != null) {
      red_flag = isRedFlagTotal(
        input.total,
        mid,
        vertical.red_flag.threshold_below_benchmark
      );
    }
  } catch {
    red_flag = false;
  }

  const quote = await store.createQuote({
    session_id: input.session_id,
    job_id: input.job_id,
    vendor_id: input.vendor_id,
    line_items: input.line_items.map(({ label, amount, optional }) => ({
      label,
      amount,
      ...(optional !== undefined ? { optional } : {}),
    })),
    total: input.total,
    red_flag,
    notes: input.notes ?? null,
  });

  return { ok: true, quote };
}
