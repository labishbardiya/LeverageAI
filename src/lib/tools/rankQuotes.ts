/**
 * rankQuotes — sort non-red-flag itemized quotes by total ASC.
 * Red-flagged quotes never rank #1 / never win.
 * Decline/callback sessions are not ranked as winners.
 */
import type { Quote, RankedQuote, Session } from "@/lib/types";

export interface RankQuotesInput {
  quotes: Quote[];
  sessions?: Session[];
  /** Vertical config (optional; reserved for future tie-breaks). */
  config?: { red_flag?: { never_rank_first?: boolean } };
}

/**
 * Uses latest quote per session. Red-flagged always after clean quotes.
 * is_winner is true only for the lowest non-red-flag total.
 * Red-flagged quotes never win rank #1 as recommended deal.
 */
export function rankQuotes(
  quotes: Quote[],
  config?: RankQuotesInput["config"],
  sessions?: Session[]
): RankedQuote[] {
  void config; // red_flag already stamped on Quote; ranking never promotes red_flag

  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]));

  // Only sessions that closed with itemized_quote (or still open with quotes)
  // Decline / callback never win.
  const eligibleSession = (session_id: string): boolean => {
    const s = sessionById.get(session_id);
    if (!s) return true; // no session info → allow ranking by quote alone
    if (s.outcome_type === "documented_decline") return false;
    if (s.outcome_type === "callback_commitment") return false;
    return true;
  };

  // Latest quote per session
  const latest = new Map<string, Quote>();
  for (const q of quotes) {
    if (!eligibleSession(q.session_id)) continue;
    const prev = latest.get(q.session_id);
    if (!prev || prev.created_at <= q.created_at) {
      latest.set(q.session_id, q);
    }
  }

  const clean: Quote[] = [];
  const flagged: Quote[] = [];
  for (const q of latest.values()) {
    if (q.red_flag) flagged.push(q);
    else clean.push(q);
  }

  clean.sort((a, b) => a.total - b.total || a.created_at.localeCompare(b.created_at));
  flagged.sort((a, b) => a.total - b.total || a.created_at.localeCompare(b.created_at));

  const ordered = [...clean, ...flagged];
  const winnerId = clean[0]?.id ?? null;

  return ordered.map((q, i) => {
    const session = sessionById.get(q.session_id);
    return {
      ...q,
      rank: i + 1,
      vendor_name: session?.vendor_name,
      is_winner: winnerId != null && q.id === winnerId && !q.red_flag,
    };
  });
}
