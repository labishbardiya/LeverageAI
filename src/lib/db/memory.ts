/**
 * In-memory store fallback when DATABASE_URL is missing.
 * Enables local demo without Neon. Same interface as Postgres store.
 *
 * Data lives on globalThis so Next.js HMR / multi-module imports share one store.
 */
import { randomUUID } from "crypto";
import type {
  Job,
  OutcomeType,
  Quote,
  Session,
  TranscriptEvent,
} from "@/lib/types";
import type {
  AppendTranscriptInput,
  CreateJobInput,
  CreateQuoteInput,
  CreateSessionInput,
  DataStore,
} from "./store";

interface MemoryTables {
  jobs: Map<string, Job>;
  sessions: Map<string, Session>;
  quotes: Map<string, Quote>;
  transcripts: TranscriptEvent[];
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
      transcriptSeq: 0,
    };
  }
  return g.__negotiatorMemory;
}

export class MemoryStore implements DataStore {
  readonly backend = "memory" as const;

  async createJob(input: CreateJobInput): Promise<Job> {
    const job: Job = {
      id: randomUUID(),
      vertical: input.vertical,
      job_spec: input.job_spec,
      status: input.status ?? "draft",
      confirmed: false,
      created_at: nowIso(),
    };
    getTables().jobs.set(job.id, job);
    return { ...job, job_spec: { ...job.job_spec } };
  }

  async getJob(id: string): Promise<Job | null> {
    const job = getTables().jobs.get(id);
    return job ? { ...job, job_spec: { ...job.job_spec } } : null;
  }

  async updateJob(
    id: string,
    patch: Partial<Pick<Job, "job_spec" | "status" | "confirmed">>
  ): Promise<Job | null> {
    const job = getTables().jobs.get(id);
    if (!job) return null;
    if (job.confirmed && patch.job_spec) {
      // confirmed jobs: job_spec immutable
      throw new Error("Job is confirmed; job_spec is immutable");
    }
    const next: Job = {
      ...job,
      ...patch,
      job_spec: patch.job_spec
        ? { ...patch.job_spec }
        : { ...job.job_spec },
    };
    getTables().jobs.set(id, next);
    return { ...next, job_spec: { ...next.job_spec } };
  }

  async confirmJob(id: string): Promise<Job | null> {
    const job = getTables().jobs.get(id);
    if (!job) return null;
    if (job.confirmed) return { ...job, job_spec: { ...job.job_spec } };
    const next: Job = {
      ...job,
      confirmed: true,
      status: "confirmed",
    };
    getTables().jobs.set(id, next);
    return { ...next, job_spec: { ...next.job_spec } };
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
        "status" | "outcome_type" | "current_total" | "callback_window"
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

    // Keep session current_total in sync
    const session = getTables().sessions.get(input.session_id);
    if (session) {
      getTables().sessions.set(input.session_id, {
        ...session,
        current_total: input.total,
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
}

/** Test helper — wipe all in-memory data */
export function resetMemoryStore(): void {
  const g = globalThis as unknown as { __negotiatorMemory?: MemoryTables };
  g.__negotiatorMemory = {
    jobs: new Map(),
    sessions: new Map(),
    quotes: new Map(),
    transcripts: [],
    transcriptSeq: 0,
  };
}
