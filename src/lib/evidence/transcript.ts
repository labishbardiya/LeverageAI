/** Keep evidence limited to words actually spoken by the two call parties. */
const INTERNAL_PROMPT_MARKERS = [
  "you are on a live call with a vendor dispatcher",
  "sound like a calm buying consultant",
  "required quote categories:",
  "company key:",
  "job json:",
  "counter strategy:",
  "rules: one idea per turn",
  "playbook (soft tactics only",
  "when you have a firm total: log_quote",
  "conversation_initiation_client_data",
  "dynamic_variables",
];

export function sanitizeTranscriptText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || text === "…" || text === "...") return null;
  const lower = text.toLowerCase();
  if (INTERNAL_PROMPT_MARKERS.some((marker) => lower.includes(marker))) {
    return null;
  }
  return text.slice(0, 4000);
}

/** Safe for API and client rendering; old persisted rows are cleaned on read. */
export function isDisplayableTranscript(value: unknown): value is string {
  return sanitizeTranscriptText(value) !== null;
}

type TranscriptLike = {
  session_id: string;
  text: string;
  speaker: string;
};

/** Remove legacy webhook duplicates while keeping the first (bridge-canonical) turn. */
export function cleanTranscriptEvents<T extends TranscriptLike>(events: T[]): T[] {
  const seen = new Map<string, string[]>();
  return events.flatMap((event) => {
    const text = sanitizeTranscriptText(event.text);
    if (!text) return [];
    const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
    const compact = normalized.replace(/[^a-z0-9$]+/g, "");
    const prior = seen.get(event.session_id) || [];
    const duplicate = prior.some(
      (value) =>
        value === compact ||
        (compact.length >= 24 &&
          (value.startsWith(compact) || compact.startsWith(value))),
    );
    if (duplicate) return [];
    prior.push(compact);
    seen.set(event.session_id, prior);
    return [{ ...event, text }];
  });
}

/** The product may request details, but it never books or accepts work. */
export function enforceNoBookingCommitment(text: string): string {
  if (
    /\b(we(?:'ll| will)? take it|book (?:it|that)|schedule (?:it|that|the)|confirm (?:the )?(?:appointment|booking)|go ahead (?:and|with)|authorize (?:the )?(?:work|job)|start (?:the )?work)\b/i.test(
      text,
    )
  ) {
    return "I cannot book, purchase, authorize work, or confirm an appointment. Please provide the written itemized quote and available callback window for the customer to review.";
  }
  if (/\b(callback|call back).{0,80}\b(works|confirm|scheduled|then)\b/i.test(text)) {
    return "Please share the available callback window for the customer to review. I cannot confirm a visit or appointment.";
  }
  return text;
}
