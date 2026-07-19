/**
 * Deterministic free-text/document extraction.
 *
 * Why deterministic first: the confirmed job specification controls every
 * negotiation and must never be filled with plausible-but-invented facts.
 * Config hints extract only values present in the source. Anything uncertain
 * is returned as a question for the user confirmation step.
 */
import type { JobSpec } from "@/lib/types";
import { loadVertical } from "@/lib/config/loadVertical";
import {
  requiredFieldQuestions,
  validateJobSpec,
  type JobSpecIssue,
} from "./jobSpec";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanText(text: string): string {
  return text.replace(/\0/g, " ").replace(/\s+/g, " ").trim().slice(0, 20_000);
}

function numberNearKeywords(text: string, keywords: string[]): number | null {
  for (const keyword of keywords) {
    const k = escapeRegex(keyword);
    const after = text.match(
      new RegExp(`${k}[^0-9]{0,18}(\\d+(?:\\.\\d+)?)`, "i"),
    );
    if (after) return Number(after[1]);
    const before = text.match(
      new RegExp(`(\\d+(?:\\.\\d+)?)[^a-z0-9]{0,8}${k}`, "i"),
    );
    if (before) return Number(before[1]);
  }
  return null;
}

function normalizedPhrase(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ").toLowerCase();
}

function enumFromText(text: string, options: string[]): string | null {
  const lower = text.toLowerCase();
  let best: { value: string; score: number } | null = null;
  for (const option of options) {
    const phrase = normalizedPhrase(option);
    if (lower.includes(phrase)) return option;
    const usefulTokens = phrase
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !["with", "only"].includes(token));
    const score = usefulTokens.filter((token) => lower.includes(token)).length;
    if (score > 0 && (!best || score > best.score)) best = { value: option, score };
  }
  return best?.value ?? null;
}

function cityFromText(text: string, direction: "from" | "to"): string | null {
  const boundary =
    direction === "from"
      ? /\b(?:from|origin|pickup(?:\s+in)?)\s+([A-Za-z][A-Za-z .'-]{1,45}?)(?=\s+to\b|,|\n|\d{5}|$)/i
      : /\b(?:to|destination|dropoff(?:\s+in)?)\s+([A-Za-z][A-Za-z .'-]{1,45}?)(?=,|\n|\d{5}|$)/i;
  return text.match(boundary)?.[1]?.trim() ?? null;
}

function stringFromText(
  field: string,
  text: string,
  hints: string[],
): string | null {
  if (field === "zip") return text.match(/\b\d{5}(?:-\d{4})?\b/)?.[0] ?? null;
  if (field.startsWith("from_") || field.includes("origin")) {
    return cityFromText(text, "from");
  }
  if (field.startsWith("to_") || field.includes("destination")) {
    return cityFromText(text, "to");
  }
  const lower = text.toLowerCase();
  const found = hints.find((hint) => lower.includes(hint.toLowerCase()));
  return found ?? null;
}

function booleanFromText(text: string, hints: string[]): boolean | null {
  for (const hint of hints) {
    const pattern = escapeRegex(hint);
    if (new RegExp(`(?:yes|have|has|done)[^.!?]{0,20}${pattern}`, "i").test(text)) {
      return true;
    }
    if (new RegExp(`(?:no|not|without)[^.!?]{0,20}${pattern}`, "i").test(text)) {
      return false;
    }
  }
  return null;
}

export type ExtractionResult = {
  job_spec: JobSpec;
  path: "heuristic";
  confidence: number;
  source_chars: number;
  missing: JobSpecIssue[];
  invalid: JobSpecIssue[];
  follow_up_questions: ReturnType<typeof requiredFieldQuestions>;
  warnings: string[];
};

export async function extractJobSpecFromUpload(input: {
  vertical: string;
  text?: string;
  filename?: string;
}): Promise<ExtractionResult> {
  const vertical = loadVertical(input.vertical);
  const text = cleanText(input.text || "");
  const lower = text.toLowerCase();
  const spec: JobSpec = {
    job_type: vertical.default_job_type,
    job_kind: vertical.default_job_type,
  };

  for (const question of vertical.intake.questions) {
    const field = question.id;
    const hints = vertical.extraction_hints[field] || [
      field.replaceAll("_", " "),
    ];
    let value: unknown = null;

    if (question.type === "number") {
      value = numberNearKeywords(text, hints);
      if (value == null && field.includes("year")) {
        const year = text.match(/\b(?:19|20)\d{2}\b/);
        if (year) value = Number(year[0]);
      }
    } else if (question.type === "enum") {
      value = enumFromText(text, question.options || []);
    } else if (question.type === "boolean") {
      value = booleanFromText(text, hints);
    } else {
      value = stringFromText(field, text, hints);
    }

    if (value != null && value !== "") spec[field] = value as JobSpec[string];
  }

  if (text) spec.notes = text.slice(0, 2_000);
  const validation = validateJobSpec(vertical, spec);
  const requiredCount = vertical.intake.questions.filter((q) => q.required).length;
  const requiredMissing = validation.missing.filter((issue) => issue.required).length;
  const confidence = requiredCount
    ? Math.max(0, Math.min(1, (requiredCount - requiredMissing) / requiredCount))
    : 1;
  const warnings: string[] = [];
  if (!text) warnings.push("No readable text was found in the upload.");
  if (text && lower.startsWith("%pdf") && text.length < 100) {
    warnings.push("The PDF contained too little extractable text; it may be scanned.");
  }

  return {
    job_spec: { ...spec, ...validation.normalized },
    path: "heuristic",
    confidence,
    source_chars: text.length,
    missing: validation.missing,
    invalid: validation.invalid,
    follow_up_questions: requiredFieldQuestions(vertical, validation),
    warnings,
  };
}
