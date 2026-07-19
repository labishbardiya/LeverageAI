/**
 * Deterministic playbook learning from transcripts.
 * Tactics: cite_competing_bid, cite_benchmark, request_itemization,
 * silence_after_anchor, ask_for_manager_price, bundle_scope_reduction
 *
 * Schema (Neon `negotiation_learnings`):
 *   id uuid PK, vertical text, tactic text, context text,
 *   outcome_delta double precision, sample_count int, updated_at timestamptz
 *   UNIQUE (vertical, tactic)
 *
 * Online selector: UCB1 in bandit.ts (selectTacticsUcb → playbook dynamic var).
 */
import { getPool, hasDatabaseUrl } from "@/lib/db/pool";
import { randomUUID } from "crypto";

export const TACTICS = [
  "cite_competing_bid",
  "cite_benchmark",
  "request_itemization",
  "silence_after_anchor",
  "ask_for_manager_price",
  "bundle_scope_reduction",
] as const;

export type Tactic = (typeof TACTICS)[number];

export type LearningRow = {
  vertical: string;
  tactic: Tactic;
  outcome_delta: number;
  sample_count: number;
  updated_at: string;
};

const DETECT: { tactic: Tactic; re: RegExp }[] = [
  {
    tactic: "cite_competing_bid",
    re: /competing|another (shop|company)|in writing|logged (bid|quote)|I have (a |\$)/i,
  },
  {
    tactic: "cite_benchmark",
    re: /fair (band|range|market)|national cost|benchmark|cost guides|typical(ly)? (\$|price)/i,
  },
  {
    tactic: "request_itemization",
    re: /itemize|line.?item|break( that)? down|every fee|all fees|quote categories/i,
  },
  {
    tactic: "ask_for_manager_price",
    re: /manager|supervisor|owner price|best (and )?final/i,
  },
  {
    tactic: "bundle_scope_reduction",
    re: /if we (skip|remove|drop)|without (the )?pad|scope reduction|basic package/i,
  },
  {
    tactic: "silence_after_anchor",
    re: /take( a)? (moment|minute)|I'?ll wait|when you'?re ready/i,
  },
];

export function detectTactic(text: string): Tactic | null {
  for (const d of DETECT) {
    if (d.re.test(text)) return d.tactic;
  }
  return null;
}

export async function upsertLearning(
  vertical: string,
  tactic: Tactic,
  delta: number
): Promise<void> {
  if (!hasDatabaseUrl()) return;
  const pool = getPool();
  // Pure atomic upsert — no SELECT/UPDATE race
  await pool.query(
    `INSERT INTO negotiation_learnings (id, vertical, tactic, context, outcome_delta, sample_count)
     VALUES ($1, $2, $3, '{}', $4, 1)
     ON CONFLICT (vertical, tactic) DO UPDATE
     SET outcome_delta = (
           negotiation_learnings.outcome_delta * negotiation_learnings.sample_count + EXCLUDED.outcome_delta
         ) / (negotiation_learnings.sample_count + 1),
         sample_count = negotiation_learnings.sample_count + 1,
         updated_at = now()`,
    [randomUUID(), vertical, tactic, delta]
  );
}

function pricesFromTranscripts(
  transcripts: { speaker: string; text: string; ts_ms: number }[]
): number[] {
  const re =
    /\$\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?)/gi;
  const out: number[] = [];
  const sorted = [...transcripts].sort((a, b) => a.ts_ms - b.ts_ms);
  for (const line of sorted) {
    if (line.speaker !== "vendor" && line.speaker !== "agent") continue;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(line.text)) !== null) {
      const raw = (m[1] || m[2] || "").replace(/,/g, "");
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 50 && n <= 500_000) out.push(Math.round(n));
    }
  }
  return out;
}

/**
 * Analyze session transcripts + price series; attribute drops to preceding tactics.
 */
export async function extractLearningsFromSession(input: {
  vertical: string;
  transcripts: { speaker: string; text: string; ts_ms: number }[];
  priceHistory: number[];
}): Promise<{ tactic: Tactic; delta: number }[]> {
  const events: { tactic: Tactic; delta: number }[] = [];
  let series = input.priceHistory.filter((n) => typeof n === "number" && n > 0);
  if (series.length < 2) {
    series = pricesFromTranscripts(input.transcripts);
  }

  const observed = new Map<Tactic, number>();
  for (const line of input.transcripts
    .filter((event) => event.speaker === "negotiator")
    .sort((a, b) => a.ts_ms - b.ts_ms)) {
    const tactic = detectTactic(line.text);
    if (tactic && !observed.has(tactic)) observed.set(tactic, line.ts_ms);
  }
  if (!observed.size) return events;

  let dropPct = 0;
  for (let i = 1; i < series.length; i++) {
    const before = series[i - 1]!;
    const after = series[i]!;
    if (after < before) {
      dropPct = Math.max(dropPct, ((before - after) / before) * 100);
    }
  }
  if (series.length >= 2 && series[0]! > series.at(-1)!) {
    dropPct = Math.max(
      dropPct,
      ((series[0]! - series.at(-1)!) / series[0]!) * 100,
    );
  }

  // One observation per tactic per session. Successful sessions credit the
  // last evidenced tactic (closest causal action); other used tactics receive
  // zero rather than disappearing, preventing survivorship bias.
  const latest = [...observed.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  for (const tactic of observed.keys()) {
    const delta = tactic === latest && dropPct > 0 ? -dropPct : 0;
    events.push({ tactic, delta });
    await upsertLearning(input.vertical, tactic, delta);
  }
  return events;
}

export async function getPlaybook(vertical: string): Promise<{
  version: number;
  sentences: string[];
  rows: LearningRow[];
}> {
  let rows: LearningRow[] = [];
  if (hasDatabaseUrl()) {
    const pool = getPool();
    const { rows: dbRows } = await pool.query(
      `SELECT vertical, tactic, outcome_delta, sample_count, updated_at
       FROM negotiation_learnings WHERE vertical = $1`,
      [vertical]
    );
    rows = dbRows.map((r) => ({
      vertical: String(r.vertical),
      tactic: r.tactic as Tactic,
      outcome_delta: Number(r.outcome_delta),
      sample_count: Number(r.sample_count),
      updated_at: new Date(r.updated_at).toISOString(),
    }));
  }

  // Empty rows are honest zero-sample observations. Exploration priors belong
  // in the UCB selector and are never presented as historical call results.
  if (rows.length === 0) {
    const now = new Date().toISOString();
    rows = TACTICS.map((tactic) => ({
      vertical,
      tactic,
      outcome_delta: 0,
      sample_count: 0,
      updated_at: now,
    }));
  }

  const ranked = [...rows].sort(
    (a, b) =>
      Math.abs(b.outcome_delta) * Math.log(b.sample_count + 1) -
      Math.abs(a.outcome_delta) * Math.log(a.sample_count + 1)
  );
  const top = ranked.slice(0, 3);
  const sentences = top.map((r) => {
    const pct = Math.abs(Math.round(r.outcome_delta));
    const label = r.tactic.replace(/_/g, " ");
    if (r.sample_count === 0) {
      return `${label}: no completed-call evidence yet - controlled exploration only.`;
    }
    return `${label}: moved price about −${pct}% on average across ${r.sample_count} calls — prefer when evidence exists (never invent figures).`;
  });

  // Honesty: no raw $ amounts in playbook sentences (only %)
  const dirty = sentences.some((s) => /\$\d/.test(s));
  if (dirty) {
    throw new Error("playbook must not contain dollar figures");
  }

  return {
    version: rows.reduce((s, r) => s + r.sample_count, 0),
    sentences,
    rows: ranked,
  };
}
