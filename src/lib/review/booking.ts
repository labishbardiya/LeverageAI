import type {
  Job,
  Quote,
  Session,
  TranscriptEvent,
} from "@/lib/types";
import type { VerticalConfig } from "@/lib/config/loadVertical";

export type BookingQuestion = {
  id: string;
  label: string;
  question: string;
  required: boolean;
  reason: string;
};

function searchableEvidence(input: {
  session?: Session;
  quote?: Quote;
  transcripts: TranscriptEvent[];
}): string {
  return [
    input.quote?.notes,
    ...(input.quote?.line_items || []).map((line) => line.label),
    ...input.transcripts
      .filter(
        (line) => !input.session || line.session_id === input.session.id,
      )
      .map((line) => line.text),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Generate only questions whose terms were not evidenced in the selected call. */
export function questionsBeforeBooking(input: {
  vertical: VerticalConfig;
  session?: Session;
  quote?: Quote;
  transcripts: TranscriptEvent[];
}): BookingQuestion[] {
  const evidence = searchableEvidence(input);
  return input.vertical.booking_terms
    .filter((term) => {
      const aliases = [term.label, ...term.aliases]
        .map((alias) => alias.toLowerCase().trim())
        .filter(Boolean);
      return !aliases.some((alias) => evidence.includes(alias));
    })
    .map((term) => ({
      id: term.id,
      label: term.label,
      question: term.question,
      required: term.required,
      reason: "Not confirmed in the itemized quote or transcript.",
    }));
}

function jobSummary(job: Job): string {
  const fields = Object.entries(job.frozen_job_spec || job.job_spec)
    .filter(
      ([key, value]) =>
        !["notes", "job_type", "job_kind"].includes(key) &&
        value != null &&
        String(value).trim(),
    )
    .slice(0, 8)
    .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`);
  return fields.join("; ");
}

/**
 * Human handoff only. The final sentence makes it impossible to interpret the
 * draft as purchase authorization, even if a user pastes it unchanged.
 */
export function buildBookingRequestDraft(input: {
  job: Job;
  session?: Session;
  quote?: Quote;
  questions: BookingQuestion[];
}): string {
  const vendor = input.session?.vendor_name || "the provider";
  const total = input.quote?.total;
  const lines = [
    `Hello ${vendor},`,
    "",
    `I am following up on the quoted ${input.job.vertical} job (${jobSummary(input.job)}).`,
  ];
  if (total != null) {
    lines.push(
      `Please send a written version of the quoted total of $${total.toLocaleString("en-US")} with every included and optional line item.`,
    );
  } else {
    lines.push("Please send a complete written, itemized quote for the confirmed scope.");
  }
  if (input.questions.length) {
    lines.push("", "Before I decide, please confirm:");
    for (const question of input.questions) lines.push(`- ${question.question}`);
  }
  lines.push(
    "",
    "This message requests written clarification only. It does not authorize work, payment, or a purchase.",
  );
  return lines.join("\n");
}
