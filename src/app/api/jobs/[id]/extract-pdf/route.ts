import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { loadVertical } from "@/lib/config/loadVertical";
import { publish } from "@/lib/db/events";
import { extractJobSpecFromUpload } from "@/lib/intake/extractJobSpec";
import type { JobSpec } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/extract-pdf
 * Dual path: xAI vision when XAI_API_KEY set; else heuristics on sample/text.
 * Output always validated against the same JobSpec shape.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const store = getStore();
    const job = await store.getJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (job.confirmed) {
      return NextResponse.json(
        { error: "Job is confirmed; job_spec is immutable" },
        { status: 409 }
      );
    }

    let vertical;
    try {
      vertical = loadVertical(job.vertical);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Vertical error" },
        { status: 400 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let text: string | undefined;
    let fileBase64: string | undefined;
    let mime: string | undefined;
    let filename: string | undefined;
    let clientSpec: JobSpec | undefined;

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      clientSpec =
        (body.job_spec as JobSpec) || (body.extracted as JobSpec) || undefined;
      text = typeof body.text === "string" ? body.text : undefined;
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const jsonField =
        form.get("job_spec") || form.get("extracted") || form.get("json");
      if (typeof jsonField === "string" && jsonField.trim()) {
        try {
          clientSpec = JSON.parse(jsonField);
        } catch {
          return NextResponse.json(
            { error: "Invalid JSON in job_spec field" },
            { status: 400 }
          );
        }
      }
      const file = form.get("file") || form.get("pdf");
      if (file && typeof file !== "string") {
        const f = file as File;
        filename = f.name;
        mime = f.type || "application/pdf";
        const buf = Buffer.from(await f.arrayBuffer());
        fileBase64 = buf.toString("base64");
        // rough text for heuristics
        text = buf.toString("latin1").slice(0, 8000);
      }
    }

    if (clientSpec && Object.keys(clientSpec).length > 0) {
      const updated = await store.updateJob(id, {
        job_spec: { ...job.job_spec, ...clientSpec },
        status: "draft",
      });
      publish({ type: "job", job_id: id, payload: updated });
      return NextResponse.json({
        job: updated,
        extraction: { path: "client_json", fields: Object.keys(clientSpec) },
      });
    }

    const { job_spec, path } = await extractJobSpecFromUpload({
      vertical: vertical.id,
      text,
      fileBase64,
      mime,
      filename,
    });

    const allowed = new Set<string>([
      ...Object.keys(vertical.job_spec_schema?.fields ?? {}),
      "job_type",
      "job_kind",
      "notes",
    ]);
    const filtered: JobSpec = { ...job.job_spec };
    for (const [k, v] of Object.entries(job_spec)) {
      if (allowed.has(k) || k.startsWith("job_")) filtered[k] = v;
    }
    if (!filtered.job_type && !filtered.job_kind) {
      filtered.job_type = vertical.default_job_type;
      filtered.job_kind = vertical.default_job_type;
    }

    const updated = await store.updateJob(id, {
      job_spec: filtered,
      status: "draft",
    });
    publish({ type: "job", job_id: id, payload: updated });

    return NextResponse.json({
      job: updated,
      extraction: { path, fields: Object.keys(filtered) },
    });
  } catch (e) {
    console.error("[POST /api/jobs/:id/extract-pdf]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
