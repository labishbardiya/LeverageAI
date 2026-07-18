/**
 * In-memory store fallback when DATABASE_URL is missing.
 */
import { randomUUID } from "crypto";
import type {
  Job,
  OutcomeType,
  Quote,
  Session,
  TranscriptEvent,
  ToolCallRecord,
} from "@/lib/types";
import type {
  AppendTranscriptInput,
  CreateJobInput,
  CreateQuoteInput,
  CreateSessionInput,
  CreateToolCallInput,
  DataStore,
} from "./store";

interface MemoryTables {
  jobs: Map<string, Job>;
  sessions: Map<string, Session>;
  quotes: Map<string, Quote>;
  transcripts: TranscriptEvent[];
  toolCalls: ToolCallRecord[];
  transcriptSeq: number;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getTables(): MemoryTables {
  const g = globalThis as unknown as { __negotiatorMemory?: MemoryTables };
  if (!g.__negotiatorMemory) {
    g.__negotiatorMemory = {
      jobs: new Map(),
      sessions: new Map(),
      quotes: new Map(),
      transcripts: [],
      toolCalls: [],
      transcriptSeq: 0,
    };
  }
  if (!g.__negotiatorMemory.toolCalls) g.__negotiatorMemory.toolCalls = [];
  return g.__negotiatorMemory;
}

export class MemoryStore implements DataStore {
  readonly backend = "memory" as const;

  async createJob(input: CreateJobInput): Promise<Job> {
    const job: Job = {
      id: randomUUID(),
      vertical: input.vertical,
      job_spec: input.job_spec,
      frozen_job_spec: null,
      status: input.status ?? "draft",
      confirmed: false,
      created_at: nowIso(),
    };
    getTables().jobs.set(job.id, job);
    return { ...job, job_spec: { ...job.job_spec } };
  }

  async getJob(id: string): Promise<Job | null> {
    const job = getTables().jobs.get(id);
    return job
      ? {
          ...job,
          job_spec: { ...job.job_spec },
          frozen_job_spec: job.frozen_job_spec
            ? { ...job.frozen_job_spec }
            : null,
        }
      : null;
  }

  async updateJob(
    id: string,
    patch: Partial<
      Pick<Job, "job_spec" | "status" | "confirmed" | "frozen_job_spec">
    >
  ): Promise<Job | null> {
    const job = getTables().jobs.get(id);
    if (!job) return null;
    if (job.confirmed && patch.job_spec) {
      throw new Error("Job is confirmed; job_spec is immutable");
    }
    const next: Job = {
      ...job,
      ...patch,
      job_spec: patch.job_spec ? { ...patch.job_spec } : { ...job.job_spec },
      frozen_job_spec:
        patch.frozen_job_spec !== undefined
          ? patch.frozen_job_spec
            ? { ...patch.frozen_job_spec }
            : null
          : job.frozen_job_spec
            ? { ...job.frozen_job_spec }
            : null,
    };
    getTables().jobs.set(id, next);
    return {
      ...next,
      job_spec: { ...next.job_spec },
      frozen_job_spec: next.frozen_job_spec
        ? { ...next.frozen_job_spec }
        : null,
    };
  }

  async confirmJob(id: string): Promise<Job | null> {
    const job = getTables().jobs.get(id);
    if (!job) return null;
    if (job.confirmed) {
      return {
        ...job,
        job_spec: { ...job.job_spec },
        frozen_job_spec: job.frozen_job_spec
          ? { ...job.frozen_job_spec }
          : { ...job.job_spec },
      };
    }
    const frozen = { ...job.job_spec };
    const next: Job = {
      ...job,
      confirmed: true,
      status: "confirmed",
      frozen_job_spec: frozen,
      job_spec: frozen,
    };
    getTables().jobs.set(id, next);
    return {
      ...next,
      job_spec: { ...next.job_spec },
      frozen_job_spec: { ...frozen },
    };
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    const ts = nowIso();
    const session: Session = {
      id: randomUUID(),
      job_id: input.job_id,
      vendor_id: input.vendor_id,
      vendor_name: input.vendor_name,
      status: input.status ?? "pending",
      outcome_type: null,
      current_total: null,
      callback_window: null,
      negotiator_conversation_id: null,
      counter_conversation_id: null,
      audio_url: null,
      recording_note: null,
      last_event_at: ts,
      created_at: ts,
      updated_at: ts,
    };
    getTables().sessions.set(session.id, session);
    return { ...session };
  }

  async getSession(id: string): Promise<Session | null> {
    const s = getTables().sessions.get(id);
    return s ? { ...s } : null;
  }

  async listSessionsByJob(job_id: string): Promise<Session[]> {
    return [...getTables().sessions.values()]
      .filter((s) => s.job_id === job_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((s) => ({ ...s }));
  }

  async updateSession(
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
  ): Promise<Session | null> {
    const s = getTables().sessions.get(id);
    if (!s) return null;
    const next: Session = {
      ...s,
      ...patch,
      updated_at: nowIso(),
    };
    getTables().sessions.set(id, next);
    return { ...next };
  }

  async createQuote(input: CreateQuoteInput): Promise<Quote> {
    const quote: Quote = {
      id: randomUUID(),
      session_id: input.session_id,
      job_id: input.job_id,
      vendor_id: input.vendor_id,
      line_items: input.line_items.map((li) => ({ ...li })),
      total: input.total,
      red_flag: input.red_flag,
      notes: input.notes ?? null,
      created_at: nowIso(),
    };
    getTables().quotes.set(quote.id, quote);

    const session = getTables().sessions.get(input.session_id);
    if (session) {
      getTables().sessions.set(input.session_id, {
        ...session,
        current_total: input.total,
        last_event_at: nowIso(),
        updated_at: nowIso(),
      });
    }

    return {
      ...quote,
      line_items: quote.line_items.map((li) => ({ ...li })),
    };
  }

  async listQuotesByJob(job_id: string): Promise<Quote[]> {
    return [...getTables().quotes.values()]
      .filter((q) => q.job_id === job_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((q) => ({
        ...q,
        line_items: q.line_items.map((li) => ({ ...li })),
      }));
  }

  async listQuotesByJobExcludingSession(
    job_id: string,
    exclude_session_id?: string
  ): Promise<Quote[]> {
    return (await this.listQuotesByJob(job_id)).filter(
      (q) => !exclude_session_id || q.session_id !== exclude_session_id
    );
  }

  async appendTranscript(
    input: AppendTranscriptInput
  ): Promise<TranscriptEvent> {
    const tables = getTables();
    tables.transcriptSeq += 1;
    const event: TranscriptEvent = {
      id: tables.transcriptSeq,
      session_id: input.session_id,
      ts_ms: input.ts_ms,
      speaker: input.speaker,
      text: input.text,
      created_at: nowIso(),
    };
    tables.transcripts.push(event);
    const session = tables.sessions.get(input.session_id);
    if (session) {
      tables.sessions.set(input.session_id, {
        ...session,
        last_event_at: nowIso(),
        updated_at: nowIso(),
      });
    }
    return { ...event };
  }

  async listTranscriptsByJob(
    job_id: string,
    limit = 200
  ): Promise<TranscriptEvent[]> {
    const sessionIds = new Set(
      (await this.listSessionsByJob(job_id)).map((s) => s.id)
    );
    return getTables()
      .transcripts.filter((t) => sessionIds.has(t.session_id))
      .slice(-limit)
      .map((t) => ({ ...t }));
  }

  async listTranscriptsBySession(
    session_id: string,
    limit = 200
  ): Promise<TranscriptEvent[]> {
    return getTables()
      .transcripts.filter((t) => t.session_id === session_id)
      .slice(-limit)
      .map((t) => ({ ...t }));
  }

  async closeSession(
    session_id: string,
    outcome_type: OutcomeType,
    callback_window?: string | null
  ): Promise<Session | null> {
    return this.updateSession(session_id, {
      status: "closed",
      outcome_type,
      callback_window: callback_window ?? null,
    });
  }

  async createToolCall(input: CreateToolCallInput): Promise<ToolCallRecord> {
    const rec: ToolCallRecord = {
      id: randomUUID(),
      session_id: input.session_id,
      job_id: input.job_id ?? null,
      tool_name: input.tool_name,
      payload: { ...input.payload },
      created_at: nowIso(),
    };
    getTables().toolCalls.push(rec);
    const session = getTables().sessions.get(input.session_id);
    if (session) {
      getTables().sessions.set(input.session_id, {
        ...session,
        last_event_at: nowIso(),
        updated_at: nowIso(),
      });
    }
    return { ...rec, payload: { ...rec.payload } };
  }

  async listToolCallsBySession(session_id: string): Promise<ToolCallRecord[]> {
    return getTables()
      .toolCalls.filter((t) => t.session_id === session_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((t) => ({ ...t, payload: { ...t.payload } }));
  }

  async listToolCallsByJob(job_id: string): Promise<ToolCallRecord[]> {
    return getTables()
      .toolCalls.filter((t) => t.job_id === job_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((t) => ({ ...t, payload: { ...t.payload } }));
  }
}

export function resetMemoryStore(): void {
  const g = globalThis as unknown as { __negotiatorMemory?: MemoryTables };
  g.__negotiatorMemory = {
    jobs: new Map(),
    sessions: new Map(),
    quotes: new Map(),
    transcripts: [],
    toolCalls: [],
    transcriptSeq: 0,
  };
}
