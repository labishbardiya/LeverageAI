/**
 * get_competing_bids — honesty backbone.
 * Returns ONLY real quotes stored for this job (never invented).
 *
 * Accepts aliases from tool-schemas:
 *   exclude_session_id | session_id (exclude self)
 *   exclude_company_key
 */
import { z } from "zod";
import { getStore } from "@/lib/db";
import type { Quote } from "@/lib/types";

export const getCompetingBidsSchema = z.object({
  job_id: z.string().uuid(),
  exclude_session_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  exclude_company_key: z.string().optional(),
});

export type CompetingBid = {
  quote_id: string;
  session_id: string;
  vendor_id: string;
  company_key: string;
  vendor_name: string | null;
  company_name: string | null;
  total: number;
  grand_total: number;
  currency: string;
  line_items: Quote["line_items"];
  red_flag: boolean;
  created_at: string;
  logged_at: string;
};

export type GetCompetingBidsResult =
  | { ok: true; job_id: string; bids: CompetingBid[] }
  | { ok: false; error: string; code: string };

export async function getCompetingBids(
  raw: unknown
): Promise<GetCompetingBidsResult> {
  const parsed = getCompetingBidsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }

  const {
    job_id,
    exclude_session_id,
    session_id,
    exclude_company_key,
  } = parsed.data;

  const store = getStore();
  const job = await store.getJob(job_id);
  if (!job) {
    return { ok: false, code: "JOB_NOT_FOUND", error: "Job does not exist" };
  }

  const excludeSession = exclude_session_id ?? session_id;
  let quotes = await store.listQuotesByJobExcludingSession(
    job_id,
    excludeSession
  );

  if (exclude_company_key) {
    quotes = quotes.filter((q) => q.vendor_id !== exclude_company_key);
  }

  const sessions = await store.listSessionsByJob(job_id);
  const nameBySession = new Map(
    sessions.map((s) => [s.id, s.vendor_name] as const)
  );
  const nameByVendor = new Map(
    sessions.map((s) => [s.vendor_id, s.vendor_name] as const)
  );

  // Latest quote per session
  const latestBySession = new Map<string, Quote>();
  for (const q of quotes) {
    const prev = latestBySession.get(q.session_id);
    if (!prev || prev.created_at <= q.created_at) {
      latestBySession.set(q.session_id, q);
    }
  }

  const bids: CompetingBid[] = [...latestBySession.values()]
    .sort((a, b) => a.total - b.total)
    .map((q) => {
      const name =
        nameBySession.get(q.session_id) ??
        nameByVendor.get(q.vendor_id) ??
        null;
      return {
        quote_id: q.id,
        session_id: q.session_id,
        vendor_id: q.vendor_id,
        company_key: q.vendor_id,
        vendor_name: name,
        company_name: name,
        total: q.total,
        grand_total: q.total,
        currency: "USD",
        line_items: q.line_items,
        red_flag: q.red_flag,
        created_at: q.created_at,
        logged_at: q.created_at,
      };
    });

  return { ok: true, job_id, bids };
}
