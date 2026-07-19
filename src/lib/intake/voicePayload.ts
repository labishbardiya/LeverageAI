import type { JobSpec } from "@/lib/types";
import type { VerticalConfig } from "@/lib/config/loadVertical";

/**
 * Convert an ElevenLabs submit_spec payload into the same config-driven shape
 * used by text and document intake. Keeping this pure makes every vertical
 * testable without starting a voice conversation or writing to the database.
 */
export function jobSpecFromVoicePayload(
  vertical: VerticalConfig,
  payload: Record<string, unknown>,
): JobSpec {
  const embedded =
    payload.job_spec &&
    typeof payload.job_spec === "object" &&
    !Array.isArray(payload.job_spec)
      ? (payload.job_spec as Record<string, unknown>)
      : {};
  const jobSpec: JobSpec = { ...embedded };

  for (const question of vertical.intake.questions) {
    const value = payload[question.id];
    if (
      value != null &&
      value !== "" &&
      (jobSpec[question.id] == null || jobSpec[question.id] === "")
    ) {
      jobSpec[question.id] = value;
    }
  }

  // Backward-compatible HVAC aliases used by previously provisioned agents.
  const directFields = [
    "system_type",
    "tonnage",
    "symptom",
    "ductwork",
    "urgency",
    "zip",
    "notes",
    "job_type",
    "job_kind",
  ];
  for (const field of directFields) {
    if (payload[field] != null) jobSpec[field] = payload[field];
  }
  if (payload.home_sqft != null) jobSpec.home_sqft = payload.home_sqft;
  else if (payload.sqft != null) jobSpec.home_sqft = payload.sqft;

  if (!jobSpec.job_type && !jobSpec.job_kind) {
    jobSpec.job_type = vertical.default_job_type;
    jobSpec.job_kind = vertical.default_job_type;
  }
  return jobSpec;
}
