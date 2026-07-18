/**
 * lookup_benchmark — ranges from vertical config only.
 *
 * Accepts:
 *   { vertical, item }  — direct item key
 *   { job_id, vertical? } — resolve job_spec + default_job_type / red_flag.benchmark_key
 */
import { z } from "zod";
import { getStore } from "@/lib/db";
import {
  getBenchmark,
  getBenchmarkMid,
  loadVertical,
  benchmarkMid,
} from "@/lib/config/loadVertical";
import { resolveJobTypeKey } from "@/lib/types";

export const lookupBenchmarkSchema = z.object({
  vertical: z.string().min(1).optional(),
  item: z.string().min(1).optional(),
  job_id: z.string().uuid().optional(),
});

export type LookupBenchmarkResult =
  | {
      ok: true;
      vertical: string;
      item: string;
      benchmark: {
        label: string;
        low: number;
        mid: number;
        high: number;
        unit?: string;
        currency: string;
      };
      benchmark_low: number;
      benchmark_mid: number;
      benchmark_high: number;
      currency: string;
      red_flag_threshold: number;
      red_flag_below_pct: number;
      notes: string;
    }
  | { ok: false; error: string; code: string };

export async function lookupBenchmark(
  raw: unknown
): Promise<LookupBenchmarkResult> {
  const parsed = lookupBenchmarkSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  let verticalId = parsed.data.vertical;
  let item = parsed.data.item;

  if (parsed.data.job_id) {
    const store = getStore();
    const job = await store.getJob(parsed.data.job_id);
    if (!job) {
      return { ok: false, code: "JOB_NOT_FOUND", error: "Job does not exist" };
    }
    verticalId = verticalId || job.vertical;
    try {
      const config = loadVertical(verticalId);
      item =
        item ||
        resolveJobTypeKey(job.job_spec, {
          default_job_type: config.default_job_type,
          benchmark_key: config.red_flag.benchmark_key,
        });
    } catch (e) {
      return {
        ok: false,
        code: "VERTICAL_ERROR",
        error: e instanceof Error ? e.message : "Failed to load vertical",
      };
    }
  }

  if (!verticalId || !item) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Provide job_id and/or vertical+item",
    };
  }

  try {
    const config = loadVertical(verticalId);
    const b = getBenchmark(config, item);
    const mid = benchmarkMid(b);
    const low = typeof b.low === "number" ? b.low : b.fair_low;
    const high = typeof b.high === "number" ? b.high : b.fair_high;
    const threshold = config.red_flag.threshold_below_benchmark;
    const pct =
      config.red_flag.threshold_pct_below_benchmark ??
      Math.round(threshold * 100);

    return {
      ok: true,
      vertical: config.id,
      item,
      benchmark: {
        label: b.label,
        low,
        mid,
        high,
        unit: b.unit,
        currency: b.currency ?? "USD",
      },
      benchmark_low: low,
      benchmark_mid: mid,
      benchmark_high: high,
      currency: b.currency ?? "USD",
      red_flag_threshold: threshold,
      red_flag_below_pct: pct,
      notes: `Market benchmark only — not a competing bid. Red-flag if total ≤ mid × (1 − ${threshold}). mid=${getBenchmarkMid(config, item)}`,
    };
  } catch (e) {
    return {
      ok: false,
      code: "LOOKUP_ERROR",
      error: e instanceof Error ? e.message : "Failed to lookup benchmark",
    };
  }
}
