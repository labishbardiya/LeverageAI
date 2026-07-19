/**
 * Intake drafts so voice agents (submit_spec) fill the JOB form.
 * Uses Postgres when DATABASE_URL is set (required on Vercel);
 * falls back to memory for pure local demos without DB.
 */
import { randomUUID } from "crypto";
import type { JobSpec } from "@/lib/types";
import { getPool, hasDatabaseUrl } from "@/lib/db/pool";

export type IntakeDraft = {
  id: string;
  vertical: string;
  job_spec: JobSpec | null;
  status: "pending" | "filled" | "expired";
  created_at: string;
  updated_at: string;
};

type Mem = { drafts: Map<string, IntakeDraft> };

function mem(): Mem {
  const g = globalThis as unknown as { __intakeDrafts?: Mem };
  if (!g.__intakeDrafts) g.__intakeDrafts = { drafts: new Map() };
  return g.__intakeDrafts;
}

function now() {
  return new Date().toISOString();
}

function mapRow(row: Record<string, unknown>): IntakeDraft {
  return {
    id: String(row.id),
    vertical: String(row.vertical),
    job_spec: (row.job_spec as JobSpec | null) ?? null,
    status: row.status as IntakeDraft["status"],
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function createIntakeDraft(
  vertical: string
): Promise<IntakeDraft> {
  const id = randomUUID();
  const created_at = now();
  if (!hasDatabaseUrl()) {
    const d: IntakeDraft = {
      id,
      vertical,
      job_spec: null,
      status: "pending",
      created_at,
      updated_at: created_at,
    };
    mem().drafts.set(id, d);
    return d;
  }
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO intake_drafts (id, vertical, job_spec, status)
     VALUES ($1, $2, NULL, 'pending')
     RETURNING *`,
    [id, vertical]
  );
  return mapRow(rows[0]);
}

export async function getIntakeDraft(
  id: string
): Promise<IntakeDraft | null> {
  if (!hasDatabaseUrl()) {
    return mem().drafts.get(id) ?? null;
  }
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM intake_drafts WHERE id = $1`,
    [id]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function fillIntakeDraft(
  id: string,
  job_spec: JobSpec
): Promise<IntakeDraft | null> {
  if (!hasDatabaseUrl()) {
    const cur = mem().drafts.get(id);
    if (!cur) return null;
    const next: IntakeDraft = {
      ...cur,
      job_spec,
      status: "filled",
      updated_at: now(),
    };
    mem().drafts.set(id, next);
    return next;
  }
  const pool = getPool();
  const { rows } = await pool.query(
    `UPDATE intake_drafts
     SET job_spec = $2::jsonb, status = 'filled', updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, JSON.stringify(job_spec)]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/**
 * Fill the most recent pending draft for this vertical (the one the UI is
 * polling). Only creates a new draft if none are pending — otherwise voice
 * intake that omits intake_id never updates the open form.
 */
export async function fillLatestByVertical(
  vertical: string,
  job_spec: JobSpec
): Promise<IntakeDraft> {
  if (!hasDatabaseUrl()) {
    const pending = [...mem().drafts.values()]
      .filter((d) => d.vertical === vertical && d.status === "pending")
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (pending[0]) {
      return (await fillIntakeDraft(pending[0].id, job_spec))!;
    }
    const d = await createIntakeDraft(vertical);
    return (await fillIntakeDraft(d.id, job_spec))!;
  }

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id FROM intake_drafts
     WHERE vertical = $1 AND status = 'pending'
     ORDER BY created_at DESC
     LIMIT 1`,
    [vertical]
  );
  if (rows[0]) {
    return (await fillIntakeDraft(String(rows[0].id), job_spec))!;
  }
  const d = await createIntakeDraft(vertical);
  return (await fillIntakeDraft(d.id, job_spec))!;
}

export async function getLatestFilled(
  vertical: string
): Promise<IntakeDraft | null> {
  if (!hasDatabaseUrl()) {
    const all = [...mem().drafts.values()]
      .filter(
        (d) =>
          d.vertical === vertical && d.status === "filled" && d.job_spec
      )
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return all[0] ?? null;
  }
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT * FROM intake_drafts
     WHERE vertical = $1 AND status = 'filled' AND job_spec IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
    [vertical]
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
