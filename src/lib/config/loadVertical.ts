/**
 * Config loader contract for vertical JSON.
 * Loads from /config/verticals/{id}.json relative to project root.
 * NEVER hardcode HVAC/movers dollar amounts — all values come from JSON.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  VerticalConfigSchema,
  toPublicVertical,
  benchmarkMid,
  isRedFlagQuote,
  type VerticalConfig,
  type JobSpec,
  type Vendor,
  type Benchmark,
  type PublicVendor,
} from "../../../config/schema";

export type {
  VerticalConfig,
  JobSpec,
  Vendor,
  Benchmark,
  PublicVendor,
};

export { benchmarkMid, isRedFlagQuote, toPublicVertical };

const cache = new Map<string, VerticalConfig>();

function verticalsDir(): string {
  return join(process.cwd(), "config", "verticals");
}

/** Filesystem-backed list of vertical ids */
export function listVerticalIds(): string[] {
  const dir = verticalsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

/**
 * Load and validate a vertical config by id.
 * @param id e.g. "hvac" | "movers" (from ?vertical= or NEXT_PUBLIC_DEFAULT_VERTICAL)
 */
export function loadVertical(id?: string | null): VerticalConfig {
  const key = (id || process.env.NEXT_PUBLIC_DEFAULT_VERTICAL || "hvac")
    .replace(/[^a-z0-9_-]/gi, "")
    .toLowerCase();
  if (!key) {
    throw new Error(`Invalid vertical id: ${id}`);
  }

  const cached = cache.get(key);
  if (cached) return cached;

  const filePath = join(verticalsDir(), `${key}.json`);
  if (!existsSync(filePath)) {
    throw new Error(
      `Vertical config not found: ${filePath}. Available: ${listVerticalIds().join(", ")}`
    );
  }

  const raw = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  const parsed = VerticalConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid vertical config (${key}): ${msg}`);
  }

  if (parsed.data.id !== key) {
    throw new Error(
      `Vertical id mismatch: file ${key}.json declares id "${parsed.data.id}"`
    );
  }

  // Normalize vendor name/persona aliases for interop with other modules
  const normalized: VerticalConfig = {
    ...parsed.data,
    name: parsed.data.name ?? parsed.data.displayName,
    label: parsed.data.label ?? parsed.data.displayName,
    vendors: parsed.data.vendors.map((v) => ({
      ...v,
      name: v.name ?? v.displayName,
      persona: v.persona ?? v.role,
    })),
  };

  cache.set(key, normalized);
  return normalized;
}

/**
 * Load vertical safe for negotiator / UI: secrets stripped from vendors.
 */
export function loadVerticalPublic(id?: string | null) {
  return toPublicVertical(loadVertical(id));
}

/**
 * Resolve vertical id from query/env with safe default.
 */
export function resolveVerticalId(
  queryVertical?: string | null,
  envDefault?: string | null
): string {
  const fromQuery = queryVertical?.trim();
  if (fromQuery) return fromQuery.toLowerCase();
  const fromEnv =
    envDefault?.trim() ||
    process.env.NEXT_PUBLIC_DEFAULT_VERTICAL?.trim() ||
    "hvac";
  return fromEnv.toLowerCase();
}

/** Demo job_spec from vertical config (never hardcode in UI) */
export function getDemoJobSpec(verticalId?: string | null): JobSpec {
  const v = loadVertical(verticalId);
  return { ...v.demo_defaults } as JobSpec;
}

/** Lookup a named benchmark on a vertical; throws if missing */
export function getBenchmark(
  config: VerticalConfig,
  key: string
): Benchmark {
  const b = config.benchmarks[key];
  if (!b) {
    throw new Error(
      `Benchmark "${key}" not found on vertical ${config.id}. Keys: ${Object.keys(config.benchmarks).join(", ")}`
    );
  }
  return b;
}

/**
 * Resolve benchmark mid for a job type key.
 * Uses default_job_type / red_flag.benchmark_key when key omitted.
 */
export function getBenchmarkMid(
  vertical: VerticalConfig,
  jobType?: string | null
): number | null {
  const key =
    jobType ||
    vertical.default_job_type ||
    vertical.red_flag.benchmark_key ||
    Object.keys(vertical.benchmarks)[0];
  if (!key) return null;
  const b = vertical.benchmarks[key];
  if (!b) return null;
  return benchmarkMid(b);
}

/**
 * Red-flag rule from config only:
 * total ≤ mid * (1 - threshold_below_benchmark) → red_flag
 */
export function isRedFlagTotal(
  total: number,
  benchmarkMidValue: number,
  thresholdBelowBenchmark: number
): boolean {
  if (benchmarkMidValue <= 0) return false;
  return total <= benchmarkMidValue * (1 - thresholdBelowBenchmark);
}

/** Vendor by role id (tough | stonewaller | upseller) */
export function getVendor(
  config: VerticalConfig,
  vendorId: "tough" | "stonewaller" | "upseller"
): Vendor {
  const v = config.vendors.find((x) => x.id === vendorId);
  if (!v) {
    throw new Error(`Vendor ${vendorId} missing on vertical ${config.id}`);
  }
  return v;
}

export function clearVerticalCache(): void {
  cache.clear();
}
