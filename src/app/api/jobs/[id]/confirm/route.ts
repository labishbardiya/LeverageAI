import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { publish } from "@/lib/db/events";
import { onSpecConfirmed } from "@/lib/orchestrator/runtime";
import { validateJobSpec } from "@/lib/intake/jobSpec";
import { loadVertical } from "@/lib/config/loadVertical";
import type { JobSpec } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/jobs/[id]/confirm — lock confirmed=true; job_spec immutable after
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    let existing = await store.getJob(id);
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (existing.confirmed) {
      return NextResponse.json({ job: existing, already_confirmed: true });
    }

    const body = (await req.json().catch(() => ({}))) as {
      confirmed?: boolean;
      job_spec?: JobSpec;
    };
    if (body.confirmed !== true) {
      return NextResponse.json(
        {
          error: "Explicit confirmation is required before negotiations start.",
          code: "CONFIRMATION_REQUIRED",
        },
        { status: 400 },
      );
    }

    if (body.job_spec && Object.keys(body.job_spec).length > 0) {
      const updated = await store.updateJob(id, { job_spec: body.job_spec });
      if (!updated) {
        return NextResponse.json({ error: "Job update failed" }, { status: 500 });
      }
      existing = updated;
    }

    const vertical = loadVertical(existing.vertical);
    const validation = validateJobSpec(vertical, existing.job_spec);
    if (!validation.ok) {
      return NextResponse.json(
        {
          error: "Complete the required job details before confirming.",
          code: "JOB_SPEC_INCOMPLETE",
          missing: validation.missing,
          invalid: validation.invalid,
        },
        { status: 422 },
      );
    }

    const normalized = await store.updateJob(id, {
      job_spec: validation.normalized,
    });
    if (!normalized) {
      return NextResponse.json({ error: "Job normalization failed" }, { status: 500 });
    }
    existing = normalized;

    if (!existing.job_spec?.job_type && !existing.job_spec?.job_kind) {
      return NextResponse.json(
        {
          error:
            "Cannot confirm job without job_spec.job_type or job_spec.job_kind",
        },
        { status: 400 }
      );
    }

    const job = await store.confirmJob(id);
    if (!job) {
      return NextResponse.json({ error: "Confirm failed" }, { status: 500 });
    }

    try {
      onSpecConfirmed(job.id, job.vertical);
    } catch (e) {
      console.warn("[confirm] xstate", e);
    }

    publish({ type: "job", job_id: job.id, payload: job });
    return NextResponse.json({ job });
  } catch (e) {
    console.error("[PATCH /api/jobs/:id/confirm]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
