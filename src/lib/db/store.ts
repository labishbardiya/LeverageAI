import type {
  Job,
  JobSpec,
  JobStatus,
  OutcomeType,
  Quote,
  Session,
  SessionStatus,
  TranscriptEvent,
  LineItem,
  ToolCallRecord,
} from "@/lib/types";

export interface CreateJobInput {
  vertical: string;
  job_spec: JobSpec;
  status?: JobStatus;
}

export interface CreateSessionInput {
  job_id: string;
  vendor_id: string;
  vendor_name: string;
  status?: SessionStatus;
}

export interface CreateQuoteInput {
  session_id: string;
  job_id: string;
  vendor_id: string;
  line_items: LineItem[];
  total: number;
  red_flag: boolean;
  notes?: string | null;
}

export interface AppendTranscriptInput {
  session_id: string;
  ts_ms: number;
  speaker: string;
  text: string;
}

export interface CreateToolCallInput {
  session_id: string;
  job_id?: string | null;
  tool_name: string;
  payload: Record<string, unknown>;
}

/**
 * Unified data access for Postgres and in-memory backends.
 */
export interface DataStore {
  readonly backend: "postgres" | "memory";

  createJob(input: CreateJobInput): Promise<Job>;
  getJob(id: string): Promise<Job | null>;
  updateJob(
    id: string,
    patch: Partial<
      Pick<Job, "job_spec" | "status" | "confirmed" | "frozen_job_spec">
    >
  ): Promise<Job | null>;
  confirmJob(id: string): Promise<Job | null>;

  createSession(input: CreateSessionInput): Promise<Session>;
  getSession(id: string): Promise<Session | null>;
  findSessionByConversationId(conversation_id: string): Promise<Session | null>;
  listSessionsByJob(job_id: string): Promise<Session[]>;
  updateSession(
    id: string,
    patch: Partial<
      Pick<
        Session,
        | "status"
        | "outcome_type"
        | "current_total"
        | "callback_window"
        | "negotiator_conversation_id"
        | "counter_conversation_id"
        | "audio_url"
        | "recording_note"
        | "last_event_at"
      >
    >
  ): Promise<Session | null>;

  createQuote(input: CreateQuoteInput): Promise<Quote>;
  listQuotesByJob(job_id: string): Promise<Quote[]>;
  listQuotesByJobExcludingSession(
    job_id: string,
    exclude_session_id?: string
  ): Promise<Quote[]>;

  appendTranscript(input: AppendTranscriptInput): Promise<TranscriptEvent>;
  listTranscriptsByJob(
    job_id: string,
    limit?: number
  ): Promise<TranscriptEvent[]>;
  listTranscriptsBySession(
    session_id: string,
    limit?: number
  ): Promise<TranscriptEvent[]>;

  closeSession(
    session_id: string,
    outcome_type: OutcomeType,
    callback_window?: string | null
  ): Promise<Session | null>;

  createToolCall(input: CreateToolCallInput): Promise<ToolCallRecord>;
  listToolCallsBySession(session_id: string): Promise<ToolCallRecord[]>;
  listToolCallsByJob(job_id: string): Promise<ToolCallRecord[]>;
}
