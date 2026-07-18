import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import {
  getDemoJobSpec,
  loadVertical,
  loadVerticalPublic,
} from "@/lib/config/loadVertical";
import { publish } from "@/lib/db/events";
import type { JobSpec } from "@/lib/types";

const createJobSchema = z.object({
  vertical: z.string().min(1).default("hvac"),
  job_spec: z.record(z.string(), z.unknown()).optional().nullable(),
  use_demo_spec: z.boolean().optional(),
});

/**
 * POST /api/jobs — create job (vertical + job_spec draft)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const verticalId = parsed.data.vertical || "hvac";
    let vertical;
    try {
      vertical = loadVertical(verticalId);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid vertical" },
        { status: 400 }
      );
    }

    let job_spec: JobSpec = {
      ...((parsed.data.job_spec ?? {}) as JobSpec),
    };

    if (parsed.data.use_demo_spec || Object.keys(job_spec).length === 0) {
      job_spec = { ...getDemoJobSpec(vertical.id), ...job_spec };
    }

    // Ensure a benchmark key exists
    if (!job_spec.job_type && !job_spec.job_kind) {
      job_spec.job_type =
        vertical.default_job_type ||
        vertical.red_flag.benchmark_key ||
        Object.keys(vertical.benchmarks)[0];
      job_spec.job_kind = job_spec.job_type;
    }

    const store = getStore();
    const job = await store.createJob({
      vertical: vertical.id,
      job_spec,
      status: "draft",
    });

    publish({ type: "job", job_id: job.id, payload: job });

    return NextResponse.json(
      {
        job,
        backend: store.backend,
        vertical: loadVerticalPublic(vertical.id),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[POST /api/jobs]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
