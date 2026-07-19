import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { loadVertical } from "@/lib/config/loadVertical";
import { publish } from "@/lib/db/events";
import { extractJobSpecFromUpload } from "@/lib/intake/extractJobSpec";
import type { JobSpec } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/extract-pdf
 * Deterministic extraction from text or text-bearing PDFs. Scanned/image-only
 * files are rejected with a useful message instead of returning invented job
 * facts. Output is validated against the active vertical schema.
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
    let filename: string | undefined;
    let clientSpec: JobSpec | undefined;
    let documentPath: "free_text" | "pdf_text" | "text_file" = "free_text";
    const warnings: string[] = [];

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
        const mime = f.type || "application/octet-stream";
        const maxBytes = 8 * 1024 * 1024;
        if (f.size > maxBytes) {
          return NextResponse.json(
            { error: "Document is larger than the 8 MB upload limit." },
            { status: 413 },
          );
        }
        const buf = Buffer.from(await f.arrayBuffer());
        if (mime === "application/pdf" || /\.pdf$/i.test(filename)) {
          try {
            const { extractText, getDocumentProxy } = await import("unpdf");
            const pdf = await getDocumentProxy(new Uint8Array(buf));
            const extracted = await extractText(pdf, { mergePages: true });
            text = [text, extracted.text].filter(Boolean).join("\n");
            documentPath = "pdf_text";
            if (extracted.text.trim().length < 30) {
              warnings.push(
                "This PDF appears scanned or contains very little selectable text. Add the missing details before confirming.",
              );
            }
          } catch (error) {
            return NextResponse.json(
              {
                error: "The PDF could not be read.",
                code: "PDF_EXTRACTION_FAILED",
                detail: error instanceof Error ? error.message : undefined,
              },
              { status: 422 },
            );
          }
        } else if (
          mime.startsWith("text/") ||
          /\.(txt|md|csv)$/i.test(filename)
        ) {
          text = [text, buf.toString("utf8")].filter(Boolean).join("\n");
          documentPath = "text_file";
        } else {
          return NextResponse.json(
            {
              error:
                "Unsupported file. Upload a text-based PDF or TXT file. Scanned images need OCR before upload.",
              code: "UNSUPPORTED_DOCUMENT_TYPE",
            },
            { status: 415 },
          );
        }
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

    const extraction = await extractJobSpecFromUpload({
      vertical: vertical.id,
      text,
      filename,
    });
    const { job_spec } = extraction;

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
      extraction: {
        ...extraction,
        path: documentPath,
        fields: Object.keys(filtered),
        warnings: [...warnings, ...extraction.warnings],
      },
    });
  } catch (e) {
    console.error("[POST /api/jobs/:id/extract-pdf]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
