import type { JobSpec } from "@/lib/types";
import {
  loadVertical,
  type VerticalConfig,
} from "@/lib/config/loadVertical";

export type JobSpecIssue = {
  field: string;
  message: string;
  required: boolean;
};

export type JobSpecValidation = {
  ok: boolean;
  normalized: JobSpec;
  missing: JobSpecIssue[];
  invalid: JobSpecIssue[];
};

function isBlank(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function normalizeValue(
  value: unknown,
  type: "string" | "number" | "boolean" | "enum",
): unknown {
  if (isBlank(value)) return undefined;
  if (type === "number") {
    const n = typeof value === "number" ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : value;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (/^(true|yes|y|1)$/i.test(String(value).trim())) return true;
    if (/^(false|no|n|0)$/i.test(String(value).trim())) return false;
    return value;
  }
  return String(value).trim();
}

/**
 * Validate a job against its active vertical. This function is shared by
 * document intake, voice intake, the confirmation API and tests so the four
 * paths cannot silently disagree about what "complete" means.
 */
export function validateJobSpec(
  verticalOrId: VerticalConfig | string,
  input: JobSpec,
): JobSpecValidation {
  const vertical =
    typeof verticalOrId === "string"
      ? loadVertical(verticalOrId)
      : verticalOrId;
  const normalized: JobSpec = {};
  const missing: JobSpecIssue[] = [];
  const invalid: JobSpecIssue[] = [];

  for (const [field, meta] of Object.entries(
    vertical.job_spec_schema.fields,
  )) {
    const raw = input[field];
    if (isBlank(raw)) {
      if (meta.required) {
        missing.push({
          field,
          required: true,
          message: `${field.replaceAll("_", " ")} is required`,
        });
      }
      continue;
    }
    const value = normalizeValue(raw, meta.type);
    if (meta.type === "number" && typeof value !== "number") {
      invalid.push({
        field,
        required: Boolean(meta.required),
        message: `${field.replaceAll("_", " ")} must be a number`,
      });
      continue;
    }
    if (meta.type === "boolean" && typeof value !== "boolean") {
      invalid.push({
        field,
        required: Boolean(meta.required),
        message: `${field.replaceAll("_", " ")} must be yes or no`,
      });
      continue;
    }
    if (
      meta.options?.length &&
      typeof value === "string" &&
      !meta.options.includes(value)
    ) {
      invalid.push({
        field,
        required: Boolean(meta.required),
        message: `${field.replaceAll("_", " ")} must be one of: ${meta.options.join(", ")}`,
      });
      continue;
    }
    if (field === "zip" && !/^\d{5}(?:-\d{4})?$/.test(String(value))) {
      invalid.push({
        field,
        required: Boolean(meta.required),
        message: "ZIP must be a 5-digit US ZIP code",
      });
      continue;
    }
    normalized[field] = value as JobSpec[string];
  }

  if (typeof input.notes === "string" && input.notes.trim()) {
    normalized.notes = input.notes.trim().slice(0, 2_000);
  }
  const jobType =
    typeof input.job_type === "string" && input.job_type.trim()
      ? input.job_type.trim()
      : typeof input.job_kind === "string" && input.job_kind.trim()
        ? input.job_kind.trim()
        : vertical.default_job_type || vertical.red_flag.benchmark_key;
  if (jobType) {
    normalized.job_type = jobType;
    normalized.job_kind = jobType;
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    normalized,
    missing,
    invalid,
  };
}

export function requiredFieldQuestions(
  verticalOrId: VerticalConfig | string,
  validation: Pick<JobSpecValidation, "missing" | "invalid">,
): Array<{ field: string; prompt: string; type: string; options?: string[] }> {
  const vertical =
    typeof verticalOrId === "string"
      ? loadVertical(verticalOrId)
      : verticalOrId;
  const fields = new Set(
    [...validation.missing, ...validation.invalid].map((issue) => issue.field),
  );
  return vertical.intake.questions
    .filter((question) => fields.has(question.id))
    .map((question) => ({
      field: question.id,
      prompt: question.prompt,
      type: question.type,
      options: question.options,
    }));
}
