/**
 * Deterministic server-side "live" negotiation for demos / reliable live shows.
 * Writes real transcripts + quotes to the store while the UI polls.
 * Does not require ElevenLabs bridges / Twilio — always works with DATABASE_URL.
 */
import { getStore } from "@/lib/db";
import { publish } from "@/lib/db/events";
import { loadVertical } from "@/lib/config/loadVertical";
import { logQuote } from "@/lib/tools/logQuote";
import { closeSession } from "@/lib/tools/closeSession";
import { recordToolCall } from "@/lib/tools/recordToolCall";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Build line items that sum exactly to `total` (required by log_quote honesty gate). */
function lineItems(
  total: number,
  parts: { label: string; weight: number }[]
): { label: string; amount: number }[] {
  if (parts.length === 0) {
    return [{ label: "Total", amount: total }];
  }
  const amounts = parts.map((p) => Math.round(total * p.weight));
  const head = amounts.slice(0, -1).reduce((a, b) => a + b, 0);
  amounts[amounts.length - 1] = total - head;
  return parts.map((p, i) => ({ label: p.label, amount: amounts[i]! }));
}

async function say(
  sessionId: string,
  jobId: string,
  speaker: string,
  text: string,
  ts_ms: number
) {
  const store = getStore();
  await store.appendTranscript({ session_id: sessionId, ts_ms, speaker, text });
  await store.updateSession(sessionId, {
    status: "live",
    last_event_at: new Date().toISOString(),
  });
  publish({
    type: "transcript",
    job_id: jobId,
    session_id: sessionId,
    payload: { speaker, text, ts_ms },
  });
}

async function mustLogQuote(raw: unknown): Promise<void> {
  const res = await logQuote(raw);
  if (!res.ok) {
    console.error("[simulate] log_quote failed", res);
    throw new Error(`log_quote: ${res.error}`);
  }
}

/**
 * Run full 3-vendor HVAC-style script for a job (works for any vertical labels from config).
 */
export async function simulateJobNegotiations(jobId: string): Promise<void> {
  const store = getStore();
  const job = await store.getJob(jobId);
  if (!job) {
    console.warn("[simulate] job not found", jobId);
    return;
  }
  const vertical = loadVertical(job.vertical);
  const sessions = await store.listSessionsByJob(jobId);
  if (!sessions.length) {
    console.warn("[simulate] no sessions", jobId);
    return;
  }

  // Prefer persona ids; fall back to order from vertical config
  const byVendor = Object.fromEntries(sessions.map((s) => [s.vendor_id, s]));
  const ordered = vertical.vendors
    .map((v) => byVendor[v.id])
    .filter(Boolean) as typeof sessions;
  const tough = byVendor["tough"] ?? ordered[0];
  const stone = byVendor["stonewaller"] ?? ordered[1];
  const upsell = byVendor["upseller"] ?? ordered[2];
  if (!tough || !stone || !upsell) {
    console.warn("[simulate] missing vendor sessions", {
      ids: sessions.map((s) => s.vendor_id),
    });
    return;
  }

  const mid =
    vertical.benchmarks[vertical.default_job_type || ""]?.mid ??
    vertical.benchmarks[Object.keys(vertical.benchmarks)[0]!]?.mid ??
    7500;

  // Dialing
  for (const s of sessions) {
    await store.updateSession(s.id, { status: "connecting" });
    publish({
      type: "session",
      job_id: jobId,
      session_id: s.id,
      payload: { status: "connecting" },
    });
  }
  await sleep(500);

  // --- Tough (Summit-style) first offer ---
  await say(
    tough.id,
    jobId,
    "negotiator",
    "Hi — I'm an AI assistant calling for a homeowner about a confirmed job. Can I get an itemized installed quote?",
    1000
  );
  await sleep(700);
  const toughOpen = Math.round(mid * 1.22);
  await say(
    tough.id,
    jobId,
    "vendor",
    `This is ${tough.vendor_name}. For that scope you're looking at about $${toughOpen} all-in.`,
    2000
  );
  await mustLogQuote({
    job_id: jobId,
    session_id: tough.id,
    company_key: tough.vendor_id,
    company_name: tough.vendor_name,
    currency: "USD",
    line_items: lineItems(toughOpen, [
      { label: "Equipment package", weight: 0.52 },
      { label: "Labor & install", weight: 0.34 },
      { label: "Permit & haul-away", weight: 0.14 },
    ]),
    grand_total: toughOpen,
  });
  await sleep(700);

  // --- Upsell first (so tough can cite competing bid) ---
  await say(
    upsell.id,
    jobId,
    "negotiator",
    "Calling for an itemized quote on the same confirmed job — please break out fees.",
    1500
  );
  await sleep(600);
  const upsellTeaser = Math.round(mid * 0.56);
  await say(
    upsell.id,
    jobId,
    "vendor",
    `${upsell.vendor_name} — we can do equipment around $${upsellTeaser} to start.`,
    2500
  );
  await mustLogQuote({
    job_id: jobId,
    session_id: upsell.id,
    company_key: upsell.vendor_id,
    company_name: upsell.vendor_name,
    currency: "USD",
    line_items: lineItems(upsellTeaser, [
      { label: "Base equipment (advertised)", weight: 1 },
    ]),
    grand_total: upsellTeaser,
  });
  await sleep(500);
  await say(
    upsell.id,
    jobId,
    "negotiator",
    "Please itemize permit, haul-away, refrigerant, and diagnostic as well.",
    3500
  );
  await sleep(700);
  const upsellTotal = Math.round(mid * 0.625); // still low → red flag vs mid
  await say(
    upsell.id,
    jobId,
    "vendor",
    `Fine — plus permit, haul-away, refrigerant, diagnostic. Call it $${upsellTotal} total.`,
    4500
  );
  await mustLogQuote({
    job_id: jobId,
    session_id: upsell.id,
    company_key: upsell.vendor_id,
    company_name: upsell.vendor_name,
    currency: "USD",
    line_items: lineItems(upsellTotal, [
      { label: "Base equipment (advertised)", weight: 0.67 },
      { label: "Permit fee", weight: 0.08 },
      { label: "Haul-away", weight: 0.07 },
      { label: "Refrigerant", weight: 0.1 },
      { label: "Diagnostic", weight: 0.08 },
    ]),
    grand_total: upsellTotal,
  });
  await recordToolCall({
    session_id: upsell.id,
    job_id: jobId,
    tool_name: "log_quote",
    payload: { total: upsellTotal },
  });
  const closeUpsell = await closeSession({
    session_id: upsell.id,
    outcome_type: "itemized_quote",
  });
  if (!closeUpsell.ok) {
    console.error("[simulate] close upsell failed", closeUpsell);
  }
  await sleep(500);

  // Competing bid tool for tough
  await recordToolCall({
    session_id: tough.id,
    job_id: jobId,
    tool_name: "get_competing_bids",
    payload: {
      result: {
        ok: true,
        bids: [
          {
            id: "sim-upsell",
            vendor_id: upsell.vendor_id,
            total: upsellTotal,
          },
        ],
      },
    },
  });
  await say(
    tough.id,
    jobId,
    "negotiator",
    `I have a competing written bid logged at $${upsellTotal} for the same scope — can you beat a fair mid-market install?`,
    5500
  );
  await sleep(700);
  const toughFinal = Math.round(mid * 1.05);
  await say(tough.id, jobId, "vendor", `Am I talking to a robot?`, 6000);
  await sleep(450);
  await say(
    tough.id,
    jobId,
    "negotiator",
    "Yes — I'm an AI assistant negotiating on behalf of my client. Happy to continue if that works.",
    6500
  );
  await sleep(550);
  await say(
    tough.id,
    jobId,
    "vendor",
    `Alright. If that's a real written number, I'll do $${toughFinal} installed, itemized.`,
    7200
  );
  await mustLogQuote({
    job_id: jobId,
    session_id: tough.id,
    company_key: tough.vendor_id,
    company_name: tough.vendor_name,
    currency: "USD",
    line_items: lineItems(toughFinal, [
      { label: "Equipment package", weight: 0.58 },
      { label: "Labor & install", weight: 0.32 },
      { label: "Permit & haul-away", weight: 0.1 },
    ]),
    grand_total: toughFinal,
  });
  const closeTough = await closeSession({
    session_id: tough.id,
    outcome_type: "itemized_quote",
  });
  if (!closeTough.ok) {
    console.error("[simulate] close tough failed", closeTough);
  }
  await sleep(500);

  // --- Stonewaller ---
  await say(
    stone.id,
    jobId,
    "negotiator",
    "Can you provide an itemized phone quote for the same confirmed job?",
    2000
  );
  await sleep(600);
  await say(
    stone.id,
    jobId,
    "vendor",
    "We don't give firm prices over the phone — policy is on-site only.",
    3000
  );
  await sleep(550);
  await say(
    stone.id,
    jobId,
    "negotiator",
    "Understood. Even a ballpark range would help the homeowner compare today.",
    4000
  );
  await sleep(550);
  await say(
    stone.id,
    jobId,
    "vendor",
    "I can't put a number on the phone. Someone will call you back weekday mornings.",
    5000
  );
  const closeStone = await closeSession({
    session_id: stone.id,
    outcome_type: "documented_decline",
    callback_window: "weekday mornings next 2 business days",
  });
  if (!closeStone.ok) {
    console.error("[simulate] close stone failed", closeStone);
  }

  await store.updateJob(jobId, { status: "complete" });
  publish({
    type: "job",
    job_id: jobId,
    payload: { status: "complete" },
  });
  console.log("[simulate] complete", jobId);
}
