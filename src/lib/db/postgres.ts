/**
 * Postgres DataStore — parameterized queries only.
 */
import type {
  Job,
  JobSpec,
  LineItem,
  OutcomeType,
  Quote,
  Session,
  TranscriptEvent,
  ToolCallRecord,
} from "@/lib/types";
import { getPool } from "./pool";
import type {
  AppendTranscriptInput,
  CreateJobInput,
  CreateQuoteInput,
  CreateSessionInput,
  CreateToolCallInput,
  DataStore,
} from "./store";

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    vertical: String(row.vertical),
    job_spec: (row.job_spec as JobSpec) ?? {},
    frozen_job_spec: (row.frozen_job_spec as JobSpec | null) ?? null,
    status: row.status as Job["status"],
    confirmed: Boolean(row.confirmed),
    created_at: new Date(String(row.created_at)).toISOString(),
  };
}

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: String(row.id),
    job_id: String(row.job_id),
    vendor_id: String(row.vendor_id),
    vendor_name: String(row.vendor_name),
    status: row.status as Session["status"],
    outcome_type: (row.outcome_type as OutcomeType | null) ?? null,
    current_total: num(row.current_total),
    callback_window:
      row.callback_window != null ? String(row.callback_window) : null,
    negotiator_conversation_id:
      row.negotiator_conversation_id != null
        ? String(row.negotiator_conversation_id)
        : null,
    counter_conversation_id:
      row.counter_conversation_id != null
        ? String(row.counter_conversation_id)
        : null,
    audio_url: row.audio_url != null ? String(row.audio_url) : null,
    recording_note:
      row.recording_note != null ? String(row.recording_note) : null,
    last_event_at:
      row.last_event_at != null
        ? new Date(String(row.last_event_at)).toISOString()
        : null,
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapQuote(row: Record<string, unknown>): Quote {
  const items = (row.line_items as LineItem[]) ?? [];
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    job_id: String(row.job_id),
    vendor_id: String(row.vendor_id),
    line_items: Array.isArray(items) ? items : [],
    total: num(row.total) ?? 0,
    red_flag: Boolean(row.red_flag),
    notes: row.notes != null ? String(row.notes) : null,
    created_at: new Date(String(row.created_at)).toISOString(),
  };
}

function mapTranscript(row: Record<string, unknown>): TranscriptEvent {
  return {
    id: Number(row.id),
    session_id: String(row.session_id),
    ts_ms: Number(row.ts_ms) || 0,
    speaker: String(row.speaker),
    text: String(row.text),
    created_at: new Date(String(row.created_at)).toISOString(),
  };
}

function mapToolCall(row: Record<string, unknown>): ToolCallRecord {
  return {
    id: String(row.id),
    session_id: String(row.session_id),
    job_id: row.job_id != null ? String(row.job_id) : null,
    tool_name: String(row.tool_name),
    payload: (row.payload as Record<string, unknown>) ?? {},
    created_at: new Date(String(row.created_at)).toISOString(),
  };
}

export class PostgresStore implements DataStore {
  readonly backend = "postgres" as const;

  async createJob(input: CreateJobInput): Promise<Job> {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO jobs (vertical, job_spec, status, confirmed)
       VALUES ($1, $2::jsonb, $3, false)
       RETURNING *`,
      [input.vertical, JSON.stringify(input.job_spec), input.status ?? "draft"]
    );
    return mapJob(rows[0]);
  }

  async getJob(id: string): Promise<Job | null> {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM jobs WHERE id = $1`, [id]);
    return rows[0] ? mapJob(rows[0]) : null;
  }

  async updateJob(
    id: string,
    patch: Partial<
      Pick<Job, "job_spec" | "status" | "confirmed" | "frozen_job_spec">
    >
  ): Promise<Job | null> {
    const existing = await this.getJob(id);
    if (!existing) return null;
    if (existing.confirmed && patch.job_spec) {
      throw new Error("Job is confirmed; job_spec is immutable");
    }

    const job_spec = patch.job_spec ?? existing.job_spec;
    const status = patch.status ?? existing.status;
    const confirmed =
      patch.confirmed !== undefined ? patch.confirmed : existing.confirmed;
    const frozen =
      patch.frozen_job_spec !== undefined
        ? patch.frozen_job_spec
        : existing.frozen_job_spec;

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE jobs
       SET job_spec = $2::jsonb,
           status = $3,
           confirmed = $4,
           frozen_job_spec = $5::jsonb
       WHERE id = $1
       RETURNING *`,
      [
        id,
        JSON.stringify(job_spec),
        status,
        confirmed,
        frozen ? JSON.stringify(frozen) : null,
      ]
    );
    return rows[0] ? mapJob(rows[0]) : null;
  }

  async confirmJob(id: string): Promise<Job | null> {
    const existing = await this.getJob(id);
    if (!existing) return null;
    const pool = getPool();
    const frozen = existing.frozen_job_spec ?? existing.job_spec;
    const { rows } = await pool.query(
      `UPDATE jobs
       SET confirmed = true,
           status = 'confirmed',
           frozen_job_spec = $2::jsonb,
           job_spec = $2::jsonb
       WHERE id = $1
       RETURNING *`,
      [id, JSON.stringify(frozen)]
    );
    return rows[0] ? mapJob(rows[0]) : null;
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO sessions (job_id, vendor_id, vendor_name, status, last_event_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING *`,
      [
        input.job_id,
        input.vendor_id,
        input.vendor_name,
        input.status ?? "pending",
      ]
    );
    return mapSession(rows[0]);
  }

  async getSession(id: string): Promise<Session | null> {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM sessions WHERE id = $1`, [
      id,
    ]);
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async findSessionByConversationId(
    conversation_id: string
  ): Promise<Session | null> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM sessions
       WHERE negotiator_conversation_id = $1 OR counter_conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [conversation_id]
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async listSessionsByJob(job_id: string): Promise<Session[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM sessions WHERE job_id = $1 ORDER BY created_at ASC`,
      [job_id]
    );
    return rows.map(mapSession);
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
    const existing = await this.getSession(id);
    if (!existing) return null;

    const next = {
      status: patch.status ?? existing.status,
      outcome_type:
        patch.outcome_type !== undefined
          ? patch.outcome_type
          : existing.outcome_type,
      current_total:
        patch.current_total !== undefined
          ? patch.current_total
          : existing.current_total,
      callback_window:
        patch.callback_window !== undefined
          ? patch.callback_window
          : existing.callback_window,
      negotiator_conversation_id:
        patch.negotiator_conversation_id !== undefined
          ? patch.negotiator_conversation_id
          : existing.negotiator_conversation_id,
      counter_conversation_id:
        patch.counter_conversation_id !== undefined
          ? patch.counter_conversation_id
          : existing.counter_conversation_id,
      audio_url:
        patch.audio_url !== undefined ? patch.audio_url : existing.audio_url,
      recording_note:
        patch.recording_note !== undefined
          ? patch.recording_note
          : existing.recording_note,
      last_event_at:
        patch.last_event_at !== undefined
          ? patch.last_event_at
          : existing.last_event_at,
    };

    const pool = getPool();
    const { rows } = await pool.query(
      `UPDATE sessions
       SET status = $2,
           outcome_type = $3,
           current_total = $4,
           callback_window = $5,
           negotiator_conversation_id = $6,
           counter_conversation_id = $7,
           audio_url = $8,
           recording_note = $9,
           last_event_at = COALESCE($10::timestamptz, last_event_at),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        next.status,
        next.outcome_type,
        next.current_total,
        next.callback_window,
        next.negotiator_conversation_id,
        next.counter_conversation_id,
        next.audio_url,
        next.recording_note,
        next.last_event_at,
      ]
    );
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async createQuote(input: CreateQuoteInput): Promise<Quote> {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO quotes (session_id, job_id, vendor_id, line_items, total, red_flag, notes)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
         RETURNING *`,
        [
          input.session_id,
          input.job_id,
          input.vendor_id,
          JSON.stringify(input.line_items),
          input.total,
          input.red_flag,
          input.notes ?? null,
        ]
      );
      await client.query(
        `UPDATE sessions
         SET current_total = $2, last_event_at = now(), updated_at = now()
         WHERE id = $1`,
        [input.session_id, input.total]
      );
      await client.query("COMMIT");
      return mapQuote(rows[0]);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async listQuotesByJob(job_id: string): Promise<Quote[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM quotes WHERE job_id = $1 ORDER BY created_at ASC`,
      [job_id]
    );
    return rows.map(mapQuote);
  }

  async listQuotesByJobExcludingSession(
    job_id: string,
    exclude_session_id?: string
  ): Promise<Quote[]> {
    const pool = getPool();
    if (exclude_session_id) {
      const { rows } = await pool.query(
        `SELECT * FROM quotes
         WHERE job_id = $1 AND session_id <> $2
         ORDER BY created_at ASC`,
        [job_id, exclude_session_id]
      );
      return rows.map(mapQuote);
    }
    return this.listQuotesByJob(job_id);
  }

  async appendTranscript(
    input: AppendTranscriptInput
  ): Promise<TranscriptEvent> {
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO transcript_events (session_id, ts_ms, speaker, text)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.session_id, input.ts_ms, input.speaker, input.text]
    );
    await pool.query(
      `UPDATE sessions SET last_event_at = now(), updated_at = now() WHERE id = $1`,
      [input.session_id]
    );
    return mapTranscript(rows[0]);
  }

  async listTranscriptsByJob(
    job_id: string,
    limit = 200
  ): Promise<TranscriptEvent[]> {
    const pool = getPool();
    // Latest N events (match memory store), chronological order for UI
    const { rows } = await pool.query(
      `SELECT * FROM (
         SELECT t.*
         FROM transcript_events t
         INNER JOIN sessions s ON s.id = t.session_id
         WHERE s.job_id = $1
         ORDER BY t.id DESC
         LIMIT $2
       ) recent
       ORDER BY id ASC`,
      [job_id, limit]
    );
    return rows.map(mapTranscript);
  }

  async listTranscriptsBySession(
    session_id: string,
    limit = 200
  ): Promise<TranscriptEvent[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM transcript_events
       WHERE session_id = $1
       ORDER BY id ASC
       LIMIT $2`,
      [session_id, limit]
    );
    return rows.map(mapTranscript);
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
    const pool = getPool();
    const { rows } = await pool.query(
      `INSERT INTO tool_calls (session_id, job_id, tool_name, payload)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [
        input.session_id,
        input.job_id ?? null,
        input.tool_name,
        JSON.stringify(input.payload),
      ]
    );
    await pool.query(
      `UPDATE sessions SET last_event_at = now(), updated_at = now() WHERE id = $1`,
      [input.session_id]
    );
    return mapToolCall(rows[0]);
  }

  async listToolCallsBySession(session_id: string): Promise<ToolCallRecord[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM tool_calls WHERE session_id = $1 ORDER BY created_at ASC`,
      [session_id]
    );
    return rows.map(mapToolCall);
  }

  async listToolCallsByJob(job_id: string): Promise<ToolCallRecord[]> {
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT * FROM tool_calls WHERE job_id = $1 ORDER BY created_at ASC`,
      [job_id]
    );
    return rows.map(mapToolCall);
  }
}
