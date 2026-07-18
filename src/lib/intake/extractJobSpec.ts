/**
 * Dual intake → one Zod-validated JobSpec.
 * a) XAI_API_KEY → grok-4 vision via OpenAI-compatible API
 * b) else deterministic heuristics for public/golden samples
 */
import { z } from "zod";
import { loadVertical } from "@/lib/config/loadVertical";

export const JobSpecZod = z
  .object({
    system_type: z.string().optional(),
    system_age_years: z.number().optional(),
    tonnage: z.number().optional(),
    home_sqft: z.number().optional(),
    symptom: z.string().optional(),
    ductwork: z.string().optional(),
    urgency: z.string().optional(),
    zip: z.string().optional(),
    notes: z.string().optional(),
    job_kind: z.string().optional(),
    job_type: z.string().optional(),
  })
  .passthrough();

export type ExtractedJobSpec = z.infer<typeof JobSpecZod>;

function heuristicFromText(text: string, verticalId: string): ExtractedJobSpec {
  const v = loadVertical(verticalId);
  const base = { ...v.demo_defaults } as ExtractedJobSpec;
  const t = text.toLowerCase();

  const zip = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zip) base.zip = zip[1];

  const ton = text.match(/(\d+(?:\.\d+)?)\s*-?\s*ton/i);
  if (ton) base.tonnage = Number(ton[1]);

  const sqft = text.match(/(\d{3,5})\s*(?:sq\.?\s*ft|square)/i);
  if (sqft) base.home_sqft = Number(sqft[1]);

  if (/not cooling|no cool|warm air|compressor/i.test(t)) {
    base.symptom = "not_cooling";
  }
  if (/central/.test(t)) base.system_type = "central_ac";
  if (/emergency|today|asap/i.test(t)) base.urgency = "emergency_today";
  else if (/this week/i.test(t)) base.urgency = "this_week";

  base.job_type = base.job_type || v.default_job_type;
  base.job_kind = base.job_kind || v.default_job_type;
  base.notes = (base.notes || "") + (text ? ` | extracted from document` : "");

  return JobSpecZod.parse(base);
}

async function extractWithXai(
  imageBase64: string,
  mime: string,
  verticalId: string
): Promise<ExtractedJobSpec> {
  const v = loadVertical(verticalId);
  const schemaHint = JSON.stringify(v.job_spec_schema.fields, null, 2);
  const body = {
    model: "grok-4",
    messages: [
      {
        role: "system",
        content: `Extract a homeowner job specification JSON for vertical "${verticalId}". Schema fields:\n${schemaHint}\nReturn ONLY valid JSON matching those fields. Include job_type/job_kind when clear.`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${imageBase64}`,
            },
          },
          {
            type: "text",
            text: "Extract the job_spec JSON from this quote / document image.",
          },
        ],
      },
    ],
    temperature: 0,
  };

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`xAI extract failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch?.[0] || content);
  return JobSpecZod.parse(parsed);
}

export async function extractJobSpecFromUpload(input: {
  vertical: string;
  text?: string;
  fileBase64?: string;
  mime?: string;
  filename?: string;
}): Promise<{ job_spec: ExtractedJobSpec; path: "xai" | "heuristic" }> {
  const vertical = input.vertical || "hvac";

  if (process.env.XAI_API_KEY && input.fileBase64) {
    try {
      let spec = await extractWithXai(
        input.fileBase64,
        input.mime || "image/png",
        vertical
      );
      const check = JobSpecZod.safeParse(spec);
      if (!check.success) {
        spec = await extractWithXai(
          input.fileBase64,
          input.mime || "image/png",
          vertical
        );
      }
      return { job_spec: JobSpecZod.parse(spec), path: "xai" };
    } catch (e) {
      console.warn("[extractJobSpec] xAI failed, falling back", e);
    }
  }

  const text =
    input.text ||
    (input.filename ? `file:${input.filename}` : "") ||
    "3-ton central AC not cooling zip 28202 this week";
  return {
    job_spec: heuristicFromText(text, vertical),
    path: "heuristic",
  };
}
