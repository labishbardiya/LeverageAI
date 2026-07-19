import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireToolWebhookAuth } from "@/lib/security/webhookAuth";
import {
  fillIntakeDraft,
  getIntakeDraft,
} from "@/lib/intake/draftStore";
import type { JobSpec } from "@/lib/types";
import { loadVertical } from "@/lib/config/loadVertical";
import { validateJobSpec } from "@/lib/intake/jobSpec";

/**
 * POST /api/tools/submit_spec
 * Called by the intake ElevenLabs agent (client or webhook tool).
 * Writes a filled draft the UI polls to populate the job form.
 */
const bodySchema = z
  .object({
    intake_id: z.string().uuid(),
    vertical: z.string().optional(),
    confirmed: z.literal(true),
    system_type: z.union([z.string(), z.null()]).optional(),
    tonnage: z.union([z.number(), z.null()]).optional(),
    sqft: z.union([z.number(), z.null()]).optional(),
    home_sqft: z.union([z.number(), z.null()]).optional(),
    symptom: z.union([z.string(), z.null()]).optional(),
    ductwork: z.union([z.string(), z.null()]).optional(),
    urgency: z.union([z.string(), z.null()]).optional(),
    zip: z.union([z.string(), z.null()]).optional(),
    notes: z.union([z.string(), z.null()]).optional(),
    job_type: z.union([z.string(), z.null()]).optional(),
    job_kind: z.union([z.string(), z.null()]).optional(),
    job_spec: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export async function POST(req: NextRequest) {
  const unauthorized = requireToolWebhookAuth(req);
  if (unauthorized) return unauthorized;

  try {
    const raw = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const b = parsed.data;
    const vertical = b.vertical || "hvac";
    const verticalConfig = loadVertical(vertical);

    const job_spec: JobSpec = {
      ...(b.job_spec || {}),
    };
    if (b.system_type != null) job_spec.system_type = b.system_type;
    if (b.tonnage != null) job_spec.tonnage = b.tonnage;
    if (b.home_sqft != null) job_spec.home_sqft = b.home_sqft;
    else if (b.sqft != null) job_spec.home_sqft = b.sqft;
    if (b.symptom != null) job_spec.symptom = b.symptom;
    if (b.ductwork != null) job_spec.ductwork = b.ductwork;
    if (b.urgency != null) job_spec.urgency = b.urgency;
    if (b.zip != null) job_spec.zip = b.zip;
    if (b.notes != null) job_spec.notes = b.notes;
    if (b.job_type != null) job_spec.job_type = b.job_type;
    if (b.job_kind != null) job_spec.job_kind = b.job_kind;
    if (!job_spec.job_type && !job_spec.job_kind) {
      job_spec.job_type = verticalConfig.default_job_type;
      job_spec.job_kind = verticalConfig.default_job_type;
    }

    const target = await getIntakeDraft(b.intake_id);
    if (!target || target.vertical !== vertical) {
      return NextResponse.json(
        {
          ok: false,
          error: "The intake session is missing, expired, or belongs to another vertical.",
          code: "INTAKE_SESSION_MISMATCH",
        },
        { status: 409 },
      );
    }
    const validation = validateJobSpec(verticalConfig, job_spec);
    if (!validation.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "The confirmed intake is incomplete.",
          code: "JOB_SPEC_INCOMPLETE",
          missing: validation.missing,
          invalid: validation.invalid,
        },
        { status: 422 },
      );
    }
    const draft = await fillIntakeDraft(b.intake_id, validation.normalized);

    return NextResponse.json({
      ok: true,
      intake_id: draft?.id,
      job_spec: validation.normalized,
      status: draft?.status,
      message:
        "Job spec saved. The LeverageAI form will pick this up automatically.",
    });
  } catch (e) {
    console.error("[submit_spec]", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "error" },
      { status: 500 }
    );
  }
}
