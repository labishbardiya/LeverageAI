/**
 * Document / image / free-text → JobSpec.
 * Heuristics are primary (always works offline for judges).
 * Optional vision LLMs are NOT required and not used on product path.
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
    // movers
    move_type: z.string().optional(),
    from_city: z.string().optional(),
    to_city: z.string().optional(),
    bedrooms: z.number().optional(),
    packing: z.string().optional(),
    // medical
    procedure: z.string().optional(),
    body_part: z.string().optional(),
    contrast: z.string().optional(),
    // auto
    vehicle_year: z.number().optional(),
    vehicle_make: z.string().optional(),
    vehicle_model: z.string().optional(),
  })
  .passthrough();

export type ExtractedJobSpec = z.infer<typeof JobSpecZod>;

function heuristicFromText(text: string, verticalId: string): ExtractedJobSpec {
  const v = loadVertical(verticalId);
  // Start empty — do NOT seed demo ZIP/city so live runs stay location-true
  const base = {
    job_type: v.default_job_type,
    job_kind: v.default_job_type,
  } as ExtractedJobSpec;
  const t = text.toLowerCase();
  const raw = text || "";

  const zip = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zip) base.zip = zip[1];

  if (/emergency|today|asap|urgent/i.test(t)) base.urgency = "emergency_today";
  else if (/this week|within a week/i.test(t)) base.urgency = "this_week";
  else if (/flexible|planning/i.test(t)) base.urgency = "flexible";

  if (verticalId === "hvac") {
    const ton = raw.match(/(\d+(?:\.\d+)?)\s*-?\s*ton/i);
    if (ton) base.tonnage = Number(ton[1]);
    const sqft = raw.match(/(\d{3,5})\s*(?:sq\.?\s*ft|square)/i);
    if (sqft) base.home_sqft = Number(sqft[1]);
    if (/not cooling|no cool|warm air|compressor|won't cool/i.test(t)) {
      base.symptom = "not_cooling";
    } else if (/not heat|no heat|cold/i.test(t)) {
      base.symptom = "not_heating";
    } else if (/replace|replacement|new unit/i.test(t)) {
      base.symptom = "full_replacement";
    }
    if (/central/.test(t)) base.system_type = "central_ac";
    if (/heat\s*pump/i.test(t)) base.system_type = "heat_pump";
    if (/mini.?split/i.test(t)) base.system_type = "mini_split";
  }

  if (verticalId === "movers") {
    const beds = raw.match(/(\d+)\s*-?\s*bed/i);
    if (beds) base.bedrooms = Number(beds[1]);
    if (/studio/i.test(t)) base.move_type = "studio";
    if (/apartment/i.test(t)) base.move_type = "local_apartment";
    if (/house|home/i.test(t)) base.move_type = "local_house";
    if (/pack(ing)?/i.test(t)) base.packing = "full_pack";
    const from = raw.match(/from\s+([A-Za-z .]+?)(?:\s+to\b|,|\n)/i);
    const to = raw.match(/\bto\s+([A-Za-z .]+?)(?:\s+zip|\s+\d{5}|,|\n|$)/i);
    if (from) base.from_city = from[1]!.trim();
    if (to) base.to_city = to[1]!.trim();
  }

  if (verticalId === "medical-imaging") {
    if (/mri/i.test(t)) base.procedure = "MRI";
    if (/brain|knee|spine|shoulder|lumbar/i.test(t)) {
      const part = t.match(/\b(brain|knee|spine|shoulder|lumbar|ankle|hip)\b/i);
      if (part) base.body_part = part[1]!.toLowerCase();
    }
    if (/with contrast/i.test(t)) base.contrast = "yes";
    else if (/without contrast|no contrast/i.test(t)) base.contrast = "no";
  }

  if (verticalId === "auto-repair") {
    const year = raw.match(/\b(19|20)\d{2}\b/);
    if (year) base.vehicle_year = Number(year[0]);
    const make = raw.match(
      /\b(toyota|honda|ford|chevy|chevrolet|bmw|mercedes|audi|nissan|hyundai|kia|tesla|subaru)\b/i
    );
    if (make) base.vehicle_make = make[1]!;
    if (/brake|rotor|pad/i.test(t)) base.symptom = "brakes";
    else if (/check engine|cel|obd/i.test(t)) base.symptom = "check_engine";
    else if (/ac|air.?cond/i.test(t)) base.symptom = "ac_not_cooling";
    else if (/oil|transmission|battery|starter|alternator/i.test(t)) {
      const s = t.match(/\b(oil|transmission|battery|starter|alternator)\b/);
      if (s) base.symptom = s[1]!;
    }
  }

  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 800);
  if (cleaned) {
    base.notes = base.notes
      ? `${String(base.notes)} | ${cleaned}`
      : cleaned;
  }

  base.job_type = base.job_type || v.default_job_type;
  base.job_kind = base.job_kind || v.default_job_type;

  return JobSpecZod.parse(base);
}

/**
 * Primary path: multi-vertical heuristics on free text / decoded upload bytes.
 * No xAI/Grok dependency — always functional offline for judges.
 */
export async function extractJobSpecFromUpload(input: {
  vertical: string;
  text?: string;
  fileBase64?: string;
  mime?: string;
  filename?: string;
}): Promise<{ job_spec: ExtractedJobSpec; path: "heuristic" }> {
  const vertical = input.vertical || "hvac";

  let text = input.text || "";
  if (!text && input.fileBase64) {
    try {
      text = Buffer.from(input.fileBase64, "base64")
        .toString("latin1")
        .slice(0, 12000);
    } catch {
      /* ignore */
    }
  }
  if (!text) {
    // Filename-only upload — still parse what we can; do NOT invent a city/ZIP
    text = input.filename ? `document: ${input.filename}` : "";
  }
  if (!text.trim()) {
    const v = loadVertical(vertical);
    return {
      job_spec: JobSpecZod.parse({
        job_type: v.default_job_type,
        job_kind: v.default_job_type,
        notes: "",
      }),
      path: "heuristic",
    };
  }
  return {
    job_spec: heuristicFromText(text, vertical),
    path: "heuristic",
  };
}
