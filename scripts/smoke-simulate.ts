/**
 * End-to-end smoke: create job → confirm → sessions → simulate → assert.
 * Usage: npx tsx scripts/smoke-simulate.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

async function main() {
  // Dynamic import after env load so pool sees DATABASE_URL
  const { getStore, resetStore, hasDatabaseUrl } = await import("../src/lib/db");
  const { simulateJobNegotiations } = await import(
    "../src/lib/sessions/simulateNegotiation"
  );
  const { loadVertical } = await import("../src/lib/config/loadVertical");

  console.log("DATABASE_URL set:", hasDatabaseUrl());
  resetStore();
  const store = getStore();
  console.log("backend:", store.backend);

  const job = await store.createJob({
    vertical: "hvac",
    job_spec: {
      job_type: "ac_replacement_3ton",
      zip: "28202",
      system_type: "central_ac",
      symptom: "full_replacement",
    },
    status: "draft",
  });
  console.log("job", job.id);

  const confirmed = await store.confirmJob(job.id);
  if (!confirmed) throw new Error("confirm failed");

  const vertical = loadVertical("hvac");
  for (const vendor of vertical.vendors) {
    await store.createSession({
      job_id: job.id,
      vendor_id: vendor.id,
      vendor_name: vendor.name ?? vendor.displayName,
      status: "pending",
    });
  }
  await store.updateJob(job.id, { status: "running" });

  await simulateJobNegotiations(job.id);

  const sessions = await store.listSessionsByJob(job.id);
  const quotes = await store.listQuotesByJob(job.id);
  const transcripts = await store.listTranscriptsByJob(job.id, 300);
  const finalJob = await store.getJob(job.id);

  console.log(
    "sessions:",
    sessions.map((s) => ({
      id: s.vendor_id,
      status: s.status,
      outcome: s.outcome_type,
      total: s.current_total,
    }))
  );
  console.log(
    "quotes:",
    quotes.length,
    quotes.map((q) => ({ v: q.vendor_id, total: q.total, rf: q.red_flag }))
  );
  console.log("transcripts:", transcripts.length);
  console.log("job status:", finalJob?.status);

  const closed = sessions.every((s) => s.outcome_type);
  if (!closed) throw new Error("not all sessions closed");
  if (quotes.length < 2) throw new Error("expected quotes");
  if (transcripts.length < 8) throw new Error("expected transcripts");
  if (finalJob?.status !== "complete") throw new Error("job not complete");
  console.log("PASS");
}

main().catch((e) => {
  console.error("FAIL", e);
  process.exit(1);
});
