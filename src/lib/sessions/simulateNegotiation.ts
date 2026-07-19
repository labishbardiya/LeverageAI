/**
 * Deterministic server-side multi-agent negotiation.
 * Runs all vendor tracks in parallel so the UI shows simultaneous activity.
 * Writes real transcripts + quotes while the UI polls.
 */
import { getStore } from "@/lib/db";
import { publish } from "@/lib/db/events";
import {
  getBenchmarkMid,
  loadVertical,
  type VerticalConfig,
} from "@/lib/config/loadVertical";
import { logQuote } from "@/lib/tools/logQuote";
import { closeSession } from "@/lib/tools/closeSession";
import { recordToolCall } from "@/lib/tools/recordToolCall";
import type { Session } from "@/lib/types";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Line items that sum exactly to `total` (log_quote honesty gate). */
function configuredLineItems(
  total: number,
  vertical: VerticalConfig,
  options?: { complete?: boolean }
): { label: string; amount: number }[] {
  const required = vertical.quote_line_items.filter((item) => item.required);
  const optional = vertical.quote_line_items.filter((item) => !item.required);
  const selected = options?.complete === false
    ? vertical.quote_line_items.slice(0, 1)
    : [...required, ...optional.slice(0, Math.max(0, 3 - required.length))];
  while (selected.length < 2 && optional[selected.length - required.length]) {
    selected.push(optional[selected.length - required.length]!);
  }
  if (selected.length === 0) {
    throw new Error(`Vertical ${vertical.id} has no configured quote categories`);
  }
  const rawWeights = selected.map((_, index) => selected.length - index);
  const weightTotal = rawWeights.reduce((sum, weight) => sum + weight, 0);
  const amounts = rawWeights.map((weight) => Math.round((total * weight) / weightTotal));
  const head = amounts.slice(0, -1).reduce((a, b) => a + b, 0);
  amounts[amounts.length - 1] = total - head;
  return selected.map((item, index) => ({
    label: item.label,
    amount: amounts[index]!,
  }));
}

function itemizationRequest(vertical: VerticalConfig): string {
  return vertical.quote_line_items
    .slice(0, 5)
    .map((item) => item.label)
    .join(", ");
}

/** Relative ms from track start — UI shows 0:01, 0:02 not wall-clock junk. */
const trackStart = new Map<string, number>();

function relTs(sessionId: string, scriptedMs: number): number {
  if (!trackStart.has(sessionId)) trackStart.set(sessionId, Date.now());
  // Prefer scripted relative offsets (already 1000, 2000, …)
  return Math.max(0, scriptedMs);
}

async function say(
  sessionId: string,
  jobId: string,
  speaker: string,
  text: string,
  ts_ms: number
) {
  const store = getStore();
  const relative = relTs(sessionId, ts_ms);
  await store.appendTranscript({
    session_id: sessionId,
    ts_ms: relative,
    speaker,
    text,
  });
  await store.updateSession(sessionId, {
    status: "live",
    last_event_at: new Date().toISOString(),
  });
  publish({
    type: "transcript",
    job_id: jobId,
    session_id: sessionId,
    payload: { speaker, text, ts_ms: relative },
  });
}

async function mustLogQuote(raw: unknown): Promise<void> {
  const res = await logQuote(raw);
  if (!res.ok) {
    console.error("[simulate] log_quote failed", res);
    throw new Error(`log_quote: ${res.error}`);
  }
}

async function markConnecting(jobId: string, sessions: Session[]) {
  const store = getStore();
  await Promise.all(
    sessions.map(async (s) => {
      await store.updateSession(s.id, { status: "connecting" });
      publish({
        type: "session",
        job_id: jobId,
        session_id: s.id,
        payload: { status: "connecting" },
      });
    })
  );
}

/** Parallel track: tough vendor (price drop after competing bid). */
async function runToughTrack(
  jobId: string,
  tough: Session,
  mid: number,
  getCompetingTotal: () => number | null,
  vertical: VerticalConfig,
): Promise<void> {
  const toughOpen = Math.round(mid * 1.22);
  await sleep(200);
  await say(
    tough.id,
    jobId,
    "negotiator",
    `Hi - I'm an AI assistant calling for a customer about a confirmed ${vertical.displayName} request. Can I get an itemized quote covering ${itemizationRequest(vertical)}?`,
    1000
  );
  await sleep(700);
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
    line_items: configuredLineItems(toughOpen, vertical),
    grand_total: toughOpen,
  });

  // Wait until upseller has a competing total (shared orchestration barrier)
  let competing: number | null = null;
  for (let i = 0; i < 40; i++) {
    competing = getCompetingTotal();
    if (competing != null) break;
    await sleep(250);
  }
  if (competing == null) competing = Math.round(mid * 0.625);

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
            vendor_id: "upseller",
            total: competing,
          },
        ],
      },
    },
  });
  await say(
    tough.id,
    jobId,
    "negotiator",
    `I have a competing written bid logged at $${competing} for the same scope — can you beat a fair mid-market install?`,
    5500
  );
  await sleep(600);
  const toughFinal = Math.round(mid * 1.05);
  await say(tough.id, jobId, "vendor", `Am I talking to a robot?`, 6000);
  await sleep(400);
  await say(
    tough.id,
    jobId,
    "negotiator",
    "Yes — I'm an AI assistant negotiating on behalf of my client. Happy to continue if that works.",
    6500
  );
  await sleep(500);
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
    line_items: configuredLineItems(toughFinal, vertical),
    grand_total: toughFinal,
    is_update: true,
  });
  const closeTough = await closeSession({
    session_id: tough.id,
    outcome_type: "itemized_quote",
  });
  if (!closeTough.ok) console.error("[simulate] close tough", closeTough);
}

/** Parallel track: upseller (bait → itemize → red flag). */
async function runUpsellTrack(
  jobId: string,
  upsell: Session,
  mid: number,
  setCompetingTotal: (n: number) => void,
  vertical: VerticalConfig,
): Promise<number> {
  await sleep(150);
  await say(
    upsell.id,
    jobId,
    "negotiator",
    `Calling for an itemized quote on the same confirmed request - please break out ${itemizationRequest(vertical)}.`,
    1500
  );
  await sleep(550);
  const upsellTeaser = Math.round(mid * 0.56);
  await say(
    upsell.id,
    jobId,
    "vendor",
    `${upsell.vendor_name} - the advertised base starts around $${upsellTeaser}.`,
    2500
  );
  await mustLogQuote({
    job_id: jobId,
    session_id: upsell.id,
    company_key: upsell.vendor_id,
    company_name: upsell.vendor_name,
    currency: "USD",
    line_items: configuredLineItems(upsellTeaser, vertical, { complete: false }),
    grand_total: upsellTeaser,
  });
  await sleep(400);
  await say(
    upsell.id,
    jobId,
    "negotiator",
    `That is not complete. Please itemize every configured category: ${itemizationRequest(vertical)}.`,
    3500
  );
  await sleep(600);
  const upsellTotal = Math.round(mid * 0.625);
  setCompetingTotal(upsellTotal);
  await say(
    upsell.id,
    jobId,
    "vendor",
    `Fine - with every disclosed category included, call it $${upsellTotal} total.`,
    4500
  );
  await mustLogQuote({
    job_id: jobId,
    session_id: upsell.id,
    company_key: upsell.vendor_id,
    company_name: upsell.vendor_name,
    currency: "USD",
    line_items: configuredLineItems(upsellTotal, vertical),
    grand_total: upsellTotal,
    is_update: true,
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
  if (!closeUpsell.ok) console.error("[simulate] close upsell", closeUpsell);
  return upsellTotal;
}

/** Parallel track: stonewaller (decline). */
async function runStoneTrack(
  jobId: string,
  stone: Session,
  vertical: VerticalConfig,
): Promise<void> {
  await sleep(180);
  await say(
    stone.id,
    jobId,
    "negotiator",
    `Can you provide an itemized quote for the confirmed ${vertical.displayName} request, including ${itemizationRequest(vertical)}?`,
    2000
  );
  await sleep(500);
  await say(
    stone.id,
    jobId,
    "vendor",
    "We don't give firm prices over the phone — policy is on-site only.",
    3000
  );
  await sleep(500);
  await say(
    stone.id,
    jobId,
    "negotiator",
    "Understood. Even a ballpark range would help the homeowner compare today.",
    4000
  );
  await sleep(500);
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
  if (!closeStone.ok) console.error("[simulate] close stone", closeStone);
}

/**
 * Run full multi-agent negotiation in parallel for a job.
 * Idempotent / resumable: sessions that already have an outcome are skipped
 * so a serverless timeout mid-run can be re-kicked to finish remaining tracks.
 */
export async function simulateJobNegotiations(jobId: string): Promise<void> {
  const store = getStore();
  const job = await store.getJob(jobId);
  if (!job) {
    console.warn("[simulate] job not found", jobId);
    return;
  }
  if (job.status === "complete") {
    console.log("[simulate] job already complete, skip", jobId);
    return;
  }
  const vertical = loadVertical(job.vertical);
  const sessions = await store.listSessionsByJob(jobId);
  if (!sessions.length) {
    console.warn("[simulate] no sessions", jobId);
    return;
  }
  // Only skip when every track is terminal (resume partial runs after timeout)
  if (sessions.every((s) => s.outcome_type != null)) {
    console.log("[simulate] all sessions already closed — marking complete", jobId);
    await store.updateJob(jobId, { status: "complete" });
    publish({
      type: "job",
      job_id: jobId,
      payload: { status: "complete" },
    });
    return;
  }

  const byVendor = Object.fromEntries(sessions.map((s) => [s.vendor_id, s]));
  const ordered = vertical.vendors
    .map((v) => byVendor[v.id])
    .filter(Boolean) as Session[];
  const tough = byVendor["tough"] ?? ordered[0];
  const stone = byVendor["stonewaller"] ?? ordered[1];
  const upsell = byVendor["upseller"] ?? ordered[2];
  if (!tough || !stone || !upsell) {
    console.warn("[simulate] missing vendor sessions", {
      ids: sessions.map((s) => s.vendor_id),
    });
    return;
  }

  const jobType =
    typeof job.job_spec.job_type === "string"
      ? job.job_spec.job_type
      : typeof job.job_spec.job_kind === "string"
        ? job.job_spec.job_kind
        : vertical.default_job_type;
  const mid = getBenchmarkMid(vertical, jobType);
  if (mid == null) {
    throw new Error(`No benchmark configured for ${vertical.id}/${jobType || "default"}`);
  }

  // Only re-dial tracks that still need work (don't reopen closed sessions)
  const openSessions = sessions.filter((s) => s.outcome_type == null);
  if (openSessions.length) {
    await markConnecting(jobId, openSessions);
    await sleep(400);
  }

  // Shared orchestration state: upseller publishes competing total for tough.
  // Seed from DB if upsell already finished (resume path).
  let competingTotal: number | null =
    upsell.outcome_type != null && upsell.current_total != null
      ? upsell.current_total
      : null;
  if (competingTotal == null) {
    const quotes = await store.listQuotesByJob(jobId);
    const upsellQuotes = quotes
      .filter((q) => q.session_id === upsell.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = upsellQuotes[upsellQuotes.length - 1];
    if (last) competingTotal = last.total;
  }
  const setCompetingTotal = (n: number) => {
    competingTotal = n;
  };
  const getCompetingTotal = () => competingTotal;

  console.log(
    `[simulate] parallel multi-agent start job=${jobId} open=${openSessions
      .map((s) => s.vendor_id)
      .join(",")}`
  );

  const tasks: Promise<unknown>[] = [];
  if (tough.outcome_type == null) {
    tasks.push(runToughTrack(jobId, tough, mid, getCompetingTotal, vertical));
  }
  if (upsell.outcome_type == null) {
    tasks.push(runUpsellTrack(jobId, upsell, mid, setCompetingTotal, vertical));
  }
  if (stone.outcome_type == null) {
    tasks.push(runStoneTrack(jobId, stone, vertical));
  }
  await Promise.all(tasks);

  // Re-read: only mark complete when every session has a terminal outcome
  const finalSessions = await store.listSessionsByJob(jobId);
  if (finalSessions.every((s) => s.outcome_type != null)) {
    await store.updateJob(jobId, { status: "complete" });
    publish({
      type: "job",
      job_id: jobId,
      payload: { status: "complete" },
    });
    console.log("[simulate] parallel complete", jobId);
  } else {
    console.warn(
      "[simulate] finished tracks but some sessions still open",
      jobId,
      finalSessions.map((s) => ({ v: s.vendor_id, o: s.outcome_type }))
    );
  }
}
