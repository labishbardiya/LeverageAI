import JSZip from "jszip";
import type { EvidenceReportInput } from "./pdf";
import { buildEvidenceReportPdf } from "./pdf";
import type { ToolCallRecord } from "@/lib/types";

export type EvidenceBundleInput = EvidenceReportInput & {
  tool_calls: ToolCallRecord[];
  app_origin: string;
};

function absoluteUrl(origin: string, value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value, origin).toString();
  } catch {
    return value;
  }
}

function transcriptMarkdown(input: EvidenceBundleInput): string {
  const lines = ["# Negotiation transcripts", ""];
  for (const session of input.sessions) {
    lines.push(`## ${session.vendor_name}`, "");
    const events = input.transcripts.filter((event) => event.session_id === session.id);
    if (!events.length) lines.push("No transcript captured.", "");
    for (const event of events) {
      const stamp = `${Math.floor(event.ts_ms / 60000)}:${String(Math.floor((event.ts_ms % 60000) / 1000)).padStart(2, "0")}`;
      lines.push(`- **${stamp} ${event.speaker}:** ${event.text}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export async function buildEvidenceBundle(input: EvidenceBundleInput): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("report.pdf", await buildEvidenceReportPdf(input));
  zip.file("quotes.json", JSON.stringify(input.quotes, null, 2));
  zip.file("transcripts.json", JSON.stringify(input.transcripts, null, 2));
  zip.file("transcripts.md", transcriptMarkdown(input));
  zip.file("tool-events.json", JSON.stringify(input.tool_calls, null, 2));
  zip.file("learning-comparison.json", JSON.stringify(input.learning, null, 2));
  zip.file("booking-request.txt", input.booking_request_draft);
  zip.file(
    "recordings.json",
    JSON.stringify(
      input.sessions.map((session) => ({
        session_id: session.id,
        provider: session.vendor_name,
        recording_url: absoluteUrl(input.app_origin, session.audio_url),
        recording_note: session.recording_note ?? null,
        elevenlabs_conversation_id: session.negotiator_conversation_id ?? null,
      })),
      null,
      2
    )
  );
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        schema_version: 2,
        generated_at: input.generated_at,
        job: input.job,
        vertical_name: input.vertical_name,
        questions_before_booking: input.questions_before_booking,
        execution_provenance: input.tool_calls
          .filter((event) => event.tool_name === "execution_provenance" || event.tool_name === "live_execution_result")
          .map((event) => ({ session_id: event.session_id, type: event.tool_name, ...event.payload })),
        disclaimer:
          "Evidence only. This bundle does not authorize work, payment, booking, or purchase.",
      },
      null,
      2
    )
  );
  zip.file(
    "README.txt",
    [
      "LeverageAI negotiation evidence bundle",
      "",
      "report.pdf: human-readable report",
      "quotes.json: persisted quote records only",
      "transcripts.json / transcripts.md: timestamped call evidence",
      "recordings.json: available recording links and storage notes",
      "tool-events.json: auditable negotiation tool activity",
      "learning-comparison.json: tactic outcomes from completed calls",
      "booking-request.txt: human-review draft; never automatic purchase",
    ].join("\n")
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
