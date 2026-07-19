import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildEvidenceReportPdf } from "../src/lib/evidence/pdf";

const created = "2026-07-19T12:00:00.000Z";
const outputDir = join(process.cwd(), "tmp", "pdfs");
mkdirSync(outputDir, { recursive: true });

async function main() {
const pdf = await buildEvidenceReportPdf({
  generated_at: created,
  vertical_name: "HVAC replacement",
  job: {
    id: "qa-evidence-run",
    vertical: "hvac",
    job_spec: { job_type: "system_replacement", zip_code: "94107" },
    frozen_job_spec: {
      job_type: "system_replacement",
      home_size_sq_ft: 1800,
      zip_code: "94107",
      urgency: "this week",
    },
    status: "complete",
    confirmed: true,
    created_at: created,
  },
  sessions: [
    {
      id: "session-1",
      job_id: "qa-evidence-run",
      vendor_id: "tough",
      vendor_name: "Northstar Heating",
      status: "closed",
      outcome_type: "itemized_quote",
      current_total: 7900,
      callback_window: null,
      audio_url: "https://example.com/recordings/session-1.mp3",
      recording_note: null,
      created_at: created,
      updated_at: created,
    },
    {
      id: "session-2",
      job_id: "qa-evidence-run",
      vendor_id: "stonewaller",
      vendor_name: "City Comfort",
      status: "closed",
      outcome_type: "documented_decline",
      current_total: null,
      callback_window: "Tomorrow, 9-11 AM",
      recording_note: "Transcript captured; audio storage was unavailable.",
      created_at: created,
      updated_at: created,
    },
  ],
  quotes: [
    {
      id: "quote-1",
      session_id: "session-1",
      job_id: "qa-evidence-run",
      vendor_id: "tough",
      line_items: [
        { label: "Equipment", amount: 4800 },
        { label: "Labor", amount: 2400 },
        { label: "Permit and disposal", amount: 700 },
      ],
      total: 7900,
      red_flag: false,
      notes: "Written quote requested; warranty term not yet confirmed.",
      created_at: created,
    },
  ],
  ranked: [
    {
      id: "quote-1",
      session_id: "session-1",
      job_id: "qa-evidence-run",
      vendor_id: "tough",
      line_items: [
        { label: "Equipment", amount: 4800 },
        { label: "Labor", amount: 2400 },
        { label: "Permit and disposal", amount: 700 },
      ],
      total: 7900,
      red_flag: false,
      notes: "Written quote requested; warranty term not yet confirmed.",
      created_at: created,
      rank: 1,
      vendor_name: "Northstar Heating",
      is_winner: true,
      leverage_chain: [
        {
          t_ms: 51_000,
          kind: "transcript_cite",
          label: "Negotiator cited a persisted competing quote before the concession.",
          amount: 8100,
          transcript_excerpt: "I have a competing written quote at $8,100.",
        },
      ],
    },
  ],
  transcripts: Array.from({ length: 45 }, (_, index) => ({
    id: index + 1,
    session_id: index % 5 === 0 ? "session-2" : "session-1",
    ts_ms: index * 4300,
    speaker: index % 2 ? "vendor" : "negotiator",
    text:
      index % 2
        ? `The revised installed total is $7,900. This is sample evidence turn ${index + 1}.`
        : `Please itemize equipment, labor, permits, disposal, and optional fees. This is sample evidence turn ${index + 1}.`,
    created_at: created,
  })),
  questions_before_booking: [
    {
      id: "warranty",
      label: "Warranty",
      question: "What labor and equipment warranties are included, and for how long?",
      required: true,
      reason: "Not confirmed in the itemized quote or transcript.",
    },
  ],
  booking_request_draft:
    "Hello Northstar Heating,\n\nPlease send the final written quote and confirm the labor and equipment warranties.\n\nThis message requests clarification only. It does not authorize work, payment, or a purchase.",
  learning: [
    {
      tactic: "request_itemization",
      sample_count: 5,
      average_price_improvement_pct: 8.4,
      selected_for_this_run: true,
    },
    {
      tactic: "cite_competing_bid",
      sample_count: 3,
      average_price_improvement_pct: 5.1,
      selected_for_this_run: true,
    },
    {
      tactic: "silence_after_anchor",
      sample_count: 0,
      average_price_improvement_pct: 0,
      selected_for_this_run: false,
    },
  ],
});

const output = join(outputDir, "evidence-report.pdf");
writeFileSync(output, pdf);
console.log(output);
}

void main();
