import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { getDemoJobSpec, loadVertical } from "@/lib/config/loadVertical";
import { publish } from "@/lib/db/events";
import type { JobSpec } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/extract-pdf
 *
 * Accepts multipart PDF and/or client-provided extracted JSON for demo.
 * Without vision keys: JSON body, multipart job_spec, rough PDF text, or demo_defaults.
 * Maps onto job_spec fields from config — does not invent schema fields.
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

    // Allowed keys from config job_spec_schema + UI fields
    const allowed = new Set<string>([
      ...Object.keys(vertical.job_spec_schema?.fields ?? {}),
      ...(vertical.job_spec_fields ?? []).map((f) =>
        typeof f === "string" ? f : f.key
      ),
      "job_type",
      "job_kind",
      "summary",
    ]);

    const contentType = req.headers.get("content-type") || "";
    let extracted: Record<string, unknown> = {};
    let source: "json" | "multipart_json" | "pdf_text" | "demo_fallback" =
      "demo_fallback";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      extracted =
        (body.job_spec as Record<string, unknown>) ||
        (body.extracted as Record<string, unknown>) ||
        {};
      source = "json";
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const jsonField =
        form.get("job_spec") || form.get("extracted") || form.get("json");
      if (typeof jsonField === "string" && jsonField.trim()) {
        try {
          extracted = JSON.parse(jsonField);
          source = "multipart_json";
        } catch {
          return NextResponse.json(
            { error: "Invalid JSON in job_spec/extracted field" },
            { status: 400 }
          );
        }
      } else {
        const file = form.get("file") || form.get("pdf");
        if (file && typeof file !== "string") {
          const buf = Buffer.from(await file.arrayBuffer());
          const text = extractRoughPdfText(buf);
          extracted = mapTextToJobSpec(text, vertical);
          source = "pdf_text";
        }
      }
    }

    if (Object.keys(extracted).length === 0) {
      extracted = { ...getDemoJobSpec(vertical.id) };
      source = "demo_fallback";
    }

    const filtered: JobSpec = { ...job.job_spec };
    for (const [k, v] of Object.entries(extracted)) {
      if (allowed.has(k)) {
        filtered[k] = v;
      }
    }
    if (!filtered.job_type && !filtered.job_kind) {
      filtered.job_type =
        vertical.default_job_type ||
        vertical.red_flag.benchmark_key ||
        Object.keys(vertical.benchmarks)[0];
      filtered.job_kind = filtered.job_type;
    }

    const updated = await store.updateJob(id, {
      job_spec: filtered,
      status: "draft",
    });

    publish({ type: "job", job_id: id, payload: updated });

    return NextResponse.json({
      job: updated,
      extraction: { source, fields: Object.keys(filtered) },
      note:
        source === "demo_fallback"
          ? "No PDF/JSON provided; applied vertical demo_defaults. Pass { job_spec } JSON for real intake."
          : undefined,
    });
  } catch (e) {
    console.error("[POST /api/jobs/:id/extract-pdf]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}

function extractRoughPdfText(buf: Buffer): string {
  const raw = buf.toString("latin1");
  const chunks: string[] = [];
  const re = /\(([^\\)]{2,200})\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const s = m[1].replace(/\\n/g, " ").trim();
    if (/[A-Za-z]{3,}/.test(s)) chunks.push(s);
  }
  return chunks.join(" ").slice(0, 4000);
}

function mapTextToJobSpec(
  text: string,
  vertical: { default_job_type?: string; demo_defaults?: Record<string, unknown> }
): Record<string, unknown> {
  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  const base = { ...(vertical.demo_defaults ?? {}) };
  return {
    ...base,
    notes:
      typeof base.notes === "string"
        ? `${base.notes} | extracted: ${text.slice(0, 200)}`
        : text.slice(0, 280),
    zip: zipMatch?.[1] ?? base.zip,
    job_type: base.job_type ?? vertical.default_job_type,
    job_kind: base.job_kind ?? base.job_type ?? vertical.default_job_type,
  };
}
