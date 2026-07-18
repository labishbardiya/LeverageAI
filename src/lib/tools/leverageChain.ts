/**
 * Build a human-readable leverage chain proving price drops
 * were preceded by get_competing_bids + transcript citation.
 */
import type {
  LeverageChainStep,
  Quote,
  ToolCallRecord,
  TranscriptEvent,
} from "@/lib/types";

function parseMoney(text: string): number[] {
  const out: number[] = [];
  const re =
    /\$\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*dollars?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = (m[1] || m[2] || "").replace(/,/g, "");
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function buildLeverageChain(input: {
  session_id: string;
  quotes: Quote[];
  tool_calls: ToolCallRecord[];
  transcripts: TranscriptEvent[];
}): LeverageChainStep[] {
  const sessionQuotes = input.quotes
    .filter((q) => q.session_id === input.session_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const tools = input.tool_calls
    .filter((t) => t.session_id === input.session_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const transcripts = input.transcripts
    .filter((t) => t.session_id === input.session_id)
    .sort((a, b) => a.ts_ms - b.ts_ms);

  const steps: LeverageChainStep[] = [];
  const sessionStart = sessionQuotes[0]
    ? new Date(sessionQuotes[0].created_at).getTime()
    : Date.now();

  for (const t of tools) {
    if (t.tool_name !== "get_competing_bids") continue;
    const bids = (t.payload?.result as { bids?: Array<{ total?: number; vendor_id?: string; id?: string }> })
      ?.bids;
    const first = Array.isArray(bids) ? bids[0] : undefined;
    const amount =
      first?.total ??
      (typeof t.payload.amount === "number" ? t.payload.amount : undefined);
    const tMs = new Date(t.created_at).getTime() - sessionStart;
    steps.push({
      t_ms: Math.max(0, tMs),
      kind: "get_competing_bids",
      label: `get_competing_bids returned ${
        amount != null ? `$${amount}` : "bid(s)"
      }${first?.vendor_id ? ` (${first.vendor_id})` : ""}${
        first?.id ? ` quote id #${first.id.slice(0, 8)}` : ""
      }`,
      amount,
      quote_id: first?.id,
      vendor_id: first?.vendor_id,
    });
  }

  for (const tr of transcripts) {
    if (tr.speaker !== "negotiator") continue;
    const amounts = parseMoney(tr.text);
    if (!amounts.length) continue;
    if (
      !/quoted|bid|competing|another (shop|company)|in writing|logged/i.test(
        tr.text
      )
    ) {
      continue;
    }
    steps.push({
      t_ms: tr.ts_ms,
      kind: "transcript_cite",
      label: `Negotiator cited leverage: "${tr.text.slice(0, 120)}${
        tr.text.length > 120 ? "…" : ""
      }"`,
      amount: amounts[0],
      transcript_excerpt: tr.text,
    });
  }

  for (let i = 1; i < sessionQuotes.length; i++) {
    const prev = sessionQuotes[i - 1]!;
    const cur = sessionQuotes[i]!;
    if (cur.total < prev.total) {
      const tMs =
        new Date(cur.created_at).getTime() -
        new Date(sessionQuotes[0]!.created_at).getTime();
      steps.push({
        t_ms: Math.max(0, tMs),
        kind: "log_quote_drop",
        label: `Counter price dropped $${prev.total} → $${cur.total} (log_quote id #${cur.id.slice(0, 8)})`,
        amount: cur.total,
        quote_id: cur.id,
        vendor_id: cur.vendor_id,
      });
    }
  }

  return steps.sort((a, b) => a.t_ms - b.t_ms);
}

/**
 * Every price-drop must be preceded by get_competing_bids whose amount
 * appears in a transcript in the same session.
 */
export function assertPriceDropsHaveLeverage(input: {
  quotes: Quote[];
  tool_calls: ToolCallRecord[];
  transcripts: TranscriptEvent[];
  session_id: string;
}): { ok: boolean; detail: string } {
  const sessionQuotes = input.quotes
    .filter((q) => q.session_id === input.session_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const drops: { at: string; from: number; to: number }[] = [];
  for (let i = 1; i < sessionQuotes.length; i++) {
    if (sessionQuotes[i]!.total < sessionQuotes[i - 1]!.total) {
      drops.push({
        at: sessionQuotes[i]!.created_at,
        from: sessionQuotes[i - 1]!.total,
        to: sessionQuotes[i]!.total,
      });
    }
  }
  if (drops.length === 0) {
    return { ok: true, detail: "no price drops in session" };
  }

  for (const drop of drops) {
    const dropTime = new Date(drop.at).getTime();
    const priorBids = input.tool_calls.filter(
      (t) =>
        t.session_id === input.session_id &&
        t.tool_name === "get_competing_bids" &&
        new Date(t.created_at).getTime() <= dropTime
    );
    if (priorBids.length === 0) {
      return {
        ok: false,
        detail: `price drop ${drop.from}→${drop.to} without prior get_competing_bids`,
      };
    }

    const bidAmounts: number[] = [];
    for (const b of priorBids) {
      const result = b.payload?.result as
        | { bids?: Array<{ total?: number }> }
        | undefined;
      if (Array.isArray(result?.bids)) {
        for (const bid of result!.bids!) {
          if (typeof bid.total === "number") bidAmounts.push(bid.total);
        }
      }
    }

    const transcriptsBefore = input.transcripts.filter(
      (t) =>
        t.session_id === input.session_id &&
        t.speaker === "negotiator" &&
        // approximate: any negotiator cite with a bid amount
        parseMoney(t.text).some((n) => bidAmounts.some((b) => Math.abs(b - n) < 1))
    );

    if (transcriptsBefore.length === 0 && bidAmounts.length > 0) {
      // Still require transcript mention of at least one bid amount somewhere in session
      const anyCite = input.transcripts.some(
        (t) =>
          t.session_id === input.session_id &&
          t.speaker === "negotiator" &&
          parseMoney(t.text).some((n) =>
            bidAmounts.some((b) => Math.abs(b - n) < 1)
          )
      );
      if (!anyCite) {
        return {
          ok: false,
          detail: `price drop ${drop.from}→${drop.to}: get_competing_bids amount not found in transcript`,
        };
      }
    }
  }

  return { ok: true, detail: `${drops.length} drop(s) backed by leverage` };
}
