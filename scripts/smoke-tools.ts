/**
 * Local smoke test for store + tools (no Next server).
 * Run: npx tsx scripts/smoke-tools.ts
 */
import { getStore, resetStore, resetMemoryStore } from "../src/lib/db";
import { logQuote } from "../src/lib/tools/logQuote";
import { getCompetingBids } from "../src/lib/tools/getCompetingBids";
import { lookupBenchmark } from "../src/lib/tools/lookupBenchmark";
import { closeSession } from "../src/lib/tools/closeSession";
import { rankQuotes } from "../src/lib/tools/rankQuotes";
import {
  getDemoJobSpec,
  loadVertical,
  getBenchmarkMid,
} from "../src/lib/config/loadVertical";

async function main() {
  resetStore();
  resetMemoryStore();
  const store = getStore();
  console.log("backend", store.backend);

  const v = loadVertical("hvac");
  console.log(
    "vertical vendors",
    v.vendors.map((x) => x.id)
  );
  console.log("default_job_type", v.default_job_type);
  console.log("mid", getBenchmarkMid(v, v.default_job_type));
  console.log("threshold", v.red_flag.threshold_below_benchmark);

  const job = await store.createJob({
    vertical: "hvac",
    job_spec: getDemoJobSpec("hvac"),
  });
  await store.confirmJob(job.id);
  const sessions = [];
  for (const vendor of v.vendors) {
    sessions.push(
      await store.createSession({
        job_id: job.id,
        vendor_id: vendor.id,
        vendor_name: vendor.name ?? vendor.displayName,
      })
    );
  }
  console.log("sessions", sessions.length);

  const bad = await logQuote({
    session_id: sessions[0].id,
    job_id: job.id,
    company_key: "tough",
    line_items: [],
    grand_total: 0,
  });
  console.log("empty line_items rejected", !bad.ok);

  const bad2 = await logQuote({
    session_id: sessions[0].id,
    job_id: job.id,
    company_key: "tough",
    line_items: [{ label: "x", amount: 100 }],
    grand_total: 50,
  });
  console.log("total mismatch rejected", !bad2.ok);

  // Fair quote near mid 7750 — not red
  const q1 = await logQuote({
    session_id: sessions[0].id,
    job_id: job.id,
    company_key: "tough",
    company_name: "Summit Air",
    currency: "USD",
    line_items: [
      { label: "Equipment", amount: 4500 },
      { label: "Labor", amount: 3000 },
      { label: "Permit", amount: 250 },
    ],
    grand_total: 7750,
  });
  console.log(
    "q1",
    q1.ok && (q1 as { quote: { total: number; red_flag: boolean } }).quote.total,
    "red",
    q1.ok && (q1 as { quote: { red_flag: boolean } }).quote.red_flag
  );

  // mid 7750 * 0.7 = 5425 → 4000 is red
  const qRed = await logQuote({
    session_id: sessions[2].id,
    job_id: job.id,
    company_key: "upseller",
    line_items: [
      { label: "Base", amount: 3000 },
      { label: "Fees", amount: 1000 },
    ],
    grand_total: 4000,
  });
  console.log(
    "red quote",
    qRed.ok && (qRed as { quote: { red_flag: boolean } }).quote.red_flag,
    qRed.ok && (qRed as { quote: { total: number } }).quote.total
  );

  const bids = await getCompetingBids({
    job_id: job.id,
    session_id: sessions[0].id,
  });
  console.log(
    "competing bids",
    bids.ok &&
      bids.bids.map((b) => ({
        v: b.company_key,
        t: b.grand_total,
        red: b.red_flag,
      }))
  );

  const bm = await lookupBenchmark({ job_id: job.id });
  console.log(
    "benchmark ok",
    bm.ok,
    bm.ok && {
      mid: bm.benchmark_mid,
      pct: bm.red_flag_below_pct,
    }
  );

  await closeSession({
    session_id: sessions[1].id,
    outcome: "documented_decline",
    callback_window: "weekday 9-5",
  });
  await closeSession({
    session_id: sessions[0].id,
    outcome: "itemized_quote",
  });
  await closeSession({
    session_id: sessions[2].id,
    outcome: "itemized_quote",
  });

  const quotes = await store.listQuotesByJob(job.id);
  const sessions2 = await store.listSessionsByJob(job.id);
  const ranked = rankQuotes(quotes, v as never, sessions2);
  console.log(
    "ranked",
    ranked.map((r) => ({
      rank: r.rank,
      vendor: r.vendor_id,
      total: r.total,
      red: r.red_flag,
      win: r.is_winner,
    }))
  );

  if (!q1.ok || q1.quote.red_flag) throw new Error("q1 should not be red");
  if (!qRed.ok || !qRed.quote.red_flag) throw new Error("qRed should be red");
  if (!ranked[0]?.is_winner || ranked[0].red_flag)
    throw new Error("winner must be non-red");
  if (ranked.find((r) => r.red_flag)?.is_winner)
    throw new Error("red cannot win");
  if (ranked[0].vendor_id !== "tough") throw new Error("tough should win");

  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
