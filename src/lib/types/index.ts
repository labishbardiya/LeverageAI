/**
 * Shared domain types for LeverageAI / The Negotiator backend.
 * Vertical-specific values come from /config/verticals/*.json only.
 */

export type OutcomeType =
  | "itemized_quote"
  | "callback_commitment"
  | "documented_decline";

export type JobStatus =
  | "draft"
  | "confirmed"
  | "discovering"
  | "running"
  | "complete";

export type SessionStatus =
  | "pending"
  | "connecting"
  | "live"
  | "closed"
  | "error"
  | "dialing"
  | "negotiating"
  | "done"
  | "declined";

export type Speaker = "negotiator" | "vendor" | "system";

export interface LineItem {
  label: string;
  amount: number;
  optional?: boolean;
}

/** Open job_spec — fields differ by vertical (see job_spec_schema in config). */
export type JobSpec = Record<string, unknown> & {
  job_type?: string;
  job_kind?: string;
};

export interface Job {
  id: string;
  vertical: string;
  job_spec: JobSpec;
  /** Immutable snapshot after confirm */
  frozen_job_spec?: JobSpec | null;
  status: JobStatus;
  confirmed: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  job_id: string;
  vendor_id: string;
  vendor_name: string;
  status: SessionStatus;
  outcome_type: OutcomeType | null;
  current_total: number | null;
  callback_window: string | null;
  negotiator_conversation_id?: string | null;
  counter_conversation_id?: string | null;
  audio_url?: string | null;
  recording_note?: string | null;
  created_at: string;
  updated_at: string;
  last_event_at?: string | null;
}

export interface Quote {
  id: string;
  session_id: string;
  job_id: string;
  vendor_id: string;
  line_items: LineItem[];
  total: number;
  red_flag: boolean;
  notes: string | null;
  created_at: string;
}

export interface TranscriptEvent {
  id: number;
  session_id: string;
  ts_ms: number;
  speaker: string;
  text: string;
  created_at: string;
}

export interface ToolCallRecord {
  id: string;
  session_id: string;
  job_id?: string | null;
  tool_name: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface LeverageChainStep {
  t_ms: number;
  kind: "get_competing_bids" | "transcript_cite" | "log_quote_drop";
  label: string;
  amount?: number;
  quote_id?: string;
  vendor_id?: string;
  transcript_excerpt?: string;
}

export interface BenchmarkRange {
  low: number;
  mid: number;
  high: number;
  unit?: string;
  label?: string;
  fair_low?: number;
  fair_high?: number;
  currency?: string;
  source?: string;
  retrieved?: string;
}

export interface VendorConfig {
  id: string;
  name: string;
  persona: "tough" | "stonewaller" | "upseller" | string;
}

export interface RedFlagConfig {
  threshold_below_benchmark: number;
  never_rank_first?: boolean;
  benchmark_key?: string;
}

export interface RankedQuote extends Quote {
  rank: number | null;
  vendor_name?: string;
  is_winner: boolean;
  leverage_chain?: LeverageChainStep[];
}

export interface JobState {
  job: Job;
  sessions: Session[];
  quotes: Quote[];
  transcripts: TranscriptEvent[];
  ranked: RankedQuote[];
  tool_calls?: ToolCallRecord[];
}

/** Resolve benchmark job-type key from a job_spec + vertical defaults */
export function resolveJobTypeKey(
  job_spec: JobSpec | Record<string, unknown>,
  defaults?: {
    default_job_type?: string;
    benchmark_key?: string;
  }
): string | undefined {
  const candidates = [
    job_spec.job_type,
    job_spec.job_kind,
    defaults?.default_job_type,
    defaults?.benchmark_key,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}
