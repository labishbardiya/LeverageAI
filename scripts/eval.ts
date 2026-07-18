/**
 * Golden / finished-run evaluator for The Negotiator.
 *
 * Usage:
 *   npx tsx scripts/eval.ts
 *   npx tsx scripts/eval.ts data/golden/run.json
 *   npm run eval
 *
 * Exit 1 on any failed assertion.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const OUTCOME_TYPES = new Set([
  "itemized_quote",
  "callback_commitment",
  "documented_decline",
]);

type LineItem = { label?: string; amount?: number };
type Quote = {
  total?: number;
  line_items?: LineItem[];
  notes?: string;
};
type PricePoint = { ts_ms?: number; total: number; note?: string };
type Session = {
  id?: string;
  vendor_id?: string;
  outcome_type?: string;
  price_history?: PricePoint[];
  quote?: Quote | null;
  /** Alternate shape: chronological quote snapshots */
  quotes?: Quote[];
  red_flag?: boolean;
  callback?: { committed?: boolean };
  callback_window?: string;
  transcript_events?: Array<{ speaker?: string; text?: string; ts_ms?: number }>;
};

type RunPayload = {
  vertical?: string;
  job_spec?: Record<string, unknown>;
  job_spec_initial?: Record<string, unknown>;
  job_spec_confirmed?: Record<string, unknown>;
  sessions?: Session[];
  benchmark_used?: { mid?: number; fair_low?: number; fair_high?: number };
  red_flag_threshold?: number;
  ranked_report?: Array<{ red_flag?: boolean; total?: number | null }>;
};

type Check = { name: string; pass: boolean; detail: string };

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function finalQuote(s: Session): Quote | null {
  if (s.quote && Array.isArray(s.quote.line_items)) return s.quote;
  const arr = s.quotes;
  if (Array.isArray(arr) && arr.length > 0) return arr[arr.length - 1] ?? null;
  return s.quote ?? null;
}

function totalsSeries(s: Session): number[] {
  if (Array.isArray(s.price_history) && s.price_history.length > 0) {
    return s.price_history.map((p) => p.total);
  }
  if (Array.isArray(s.quotes) && s.quotes.length > 0) {
    return s.quotes
      .map((q) => q.total)
      .filter((t): t is number => typeof t === "number");
  }
  const q = finalQuote(s);
  return typeof q?.total === "number" ? [q.total] : [];
}

function loadRun(pathArg?: string): { path: string; run: RunPayload } {
  const p = resolve(
    pathArg?.trim() || join(process.cwd(), "data", "golden", "run.json")
  );
  if (!existsSync(p)) {
    console.error(`Run file not found: ${p}`);
    process.exit(1);
  }
  const run = JSON.parse(readFileSync(p, "utf8")) as RunPayload;
  return { path: p, run };
}

function assertItemizedLineItems(run: RunPayload): Check {
  const sessions = run.sessions ?? [];
  const itemized = sessions.filter((s) => s.outcome_type === "itemized_quote");
  if (itemized.length === 0) {
    return {
      name: "itemized_quote line_items",
      pass: false,
      detail: "No sessions with outcome_type itemized_quote",
    };
  }
  const bad = itemized.filter((s) => {
    const q = finalQuote(s);
    return !q || !Array.isArray(q.line_items) || q.line_items.length === 0;
  });
  return {
    name: "itemized_quote line_items",
    pass: bad.length === 0,
    detail:
      bad.length === 0
        ? `${itemized.length} itemized quote(s) have non-empty line_items`
        : `Missing line_items on: ${bad.map((s) => s.id ?? s.vendor_id).join(", ")}`,
  };
}

function assertRedFlagOrBelowBenchmark(run: RunPayload): Check {
  const sessions = run.sessions ?? [];
  const threshold = run.red_flag_threshold ?? 0.3;
  let mid = run.benchmark_used?.mid;
  if (
    mid == null &&
    run.benchmark_used?.fair_low != null &&
    run.benchmark_used?.fair_high != null
  ) {
    mid = (run.benchmark_used.fair_low + run.benchmark_used.fair_high) / 2;
  }

  const anyFlag = sessions.some((s) => s.red_flag === true);
  const reportFlag = (run.ranked_report ?? []).some((r) => r.red_flag === true);

  let below = false;
  if (mid != null && mid > 0) {
    const cutoff = mid * (1 - threshold);
    for (const s of sessions) {
      const total = finalQuote(s)?.total;
      if (typeof total === "number" && total <= cutoff) {
        below = true;
        break;
      }
    }
  }

  const pass = anyFlag || reportFlag || below;
  return {
    name: "red_flag or ≥30% below benchmark mid",
    pass,
    detail: pass
      ? `flagged=${anyFlag || reportFlag}, below_mid=${below}, mid=${mid ?? "n/a"}, threshold=${threshold}`
      : `No red_flag and no total ≤ mid*(1-${threshold}) (mid=${mid ?? "missing"})`,
  };
}

function assertPriceDecrease(run: RunPayload): Check {
  const sessions = run.sessions ?? [];
  const drops: string[] = [];
  for (const s of sessions) {
    const series = totalsSeries(s);
    for (let i = 1; i < series.length; i++) {
      if (series[i]! < series[i - 1]!) {
        drops.push(
          `${s.id ?? s.vendor_id}: ${series[i - 1]} → ${series[i]}`
        );
      }
    }
  }
  return {
    name: "price decrease mid-session",
    pass: drops.length > 0,
    detail:
      drops.length > 0
        ? drops.join("; ")
        : "No session price_history/quotes shows a decrease",
  };
}

function assertStructuredOutcomes(run: RunPayload): Check {
  const sessions = run.sessions ?? [];
  if (sessions.length === 0) {
    return {
      name: "structured outcome_type",
      pass: false,
      detail: "No sessions in run",
    };
  }
  const bad = sessions.filter(
    (s) => !s.outcome_type || !OUTCOME_TYPES.has(s.outcome_type)
  );
  return {
    name: "structured outcome_type",
    pass: bad.length === 0,
    detail:
      bad.length === 0
        ? `All ${sessions.length} session(s): ${[...new Set(sessions.map((s) => s.outcome_type))].join(" | ")}`
        : `Invalid/missing outcome: ${bad.map((s) => s.id ?? "?").join(", ")}`,
  };
}

function assertJobSpecFrozen(run: RunPayload): Check {
  const initial = run.job_spec_initial;
  const confirmed = run.job_spec_confirmed;
  if (initial == null && confirmed == null) {
    const ok = run.job_spec != null && Object.keys(run.job_spec).length > 0;
    return {
      name: "job_spec frozen (initial≡confirmed)",
      pass: ok,
      detail: ok
        ? "Only job_spec present (no initial/confirmed pair); non-empty OK"
        : "Missing job_spec",
    };
  }
  if (initial == null || confirmed == null) {
    return {
      name: "job_spec frozen (initial≡confirmed)",
      pass: false,
      detail: "Only one of job_spec_initial / job_spec_confirmed present",
    };
  }
  const match = deepEqual(initial, confirmed);
  const withFinal =
    run.job_spec == null ? true : deepEqual(run.job_spec, confirmed);
  return {
    name: "job_spec frozen (initial≡confirmed)",
    pass: match && withFinal,
    detail:
      match && withFinal
        ? "job_spec_initial === job_spec_confirmed === job_spec"
        : "Mismatch between initial / confirmed / job_spec",
  };
}

function printTable(checks: Check[], runPath: string, vertical?: string) {
  const rows = checks.map((c) => ({
    status: c.pass ? "PASS" : "FAIL",
    name: c.name,
    detail: c.detail,
  }));
  const nameW = Math.max(24, ...rows.map((r) => r.name.length));
  const sep = `| ${"-".repeat(6)} | ${"-".repeat(nameW)} | ${"-".repeat(40)} |`;
  console.log(`\n# Eval: The Negotiator\n`);
  console.log(`- **run:** \`${runPath}\``);
  console.log(`- **vertical:** ${vertical ?? "unknown"}`);
  console.log(`- **checks:** ${checks.length}`);
  console.log("");
  console.log(`| Status | ${"Check".padEnd(nameW)} | Detail |`);
  console.log(sep);
  for (const r of rows) {
    const detail =
      r.detail.length > 80 ? r.detail.slice(0, 77) + "..." : r.detail;
    console.log(
      `| ${r.status.padEnd(6)} | ${r.name.padEnd(nameW)} | ${detail} |`
    );
  }
  const failed = checks.filter((c) => !c.pass).length;
  const passed = checks.length - failed;
  console.log("");
  console.log(
    `**Result:** ${passed}/${checks.length} passed${failed ? ` · ${failed} failed` : " · all green"}`
  );
  console.log("");
}

function main() {
  const arg = process.argv[2];
  const { path, run } = loadRun(arg);

  const checks: Check[] = [
    assertItemizedLineItems(run),
    assertRedFlagOrBelowBenchmark(run),
    assertPriceDecrease(run),
    assertStructuredOutcomes(run),
    assertJobSpecFrozen(run),
  ];

  printTable(checks, path, run.vertical);

  if (checks.some((c) => !c.pass)) {
    process.exit(1);
  }
}

main();
