import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  Job,
  Quote,
  RankedQuote,
  Session,
  TranscriptEvent,
} from "@/lib/types";
import type { BookingQuestion } from "@/lib/review/booking";

export type LearningEvidence = {
  tactic: string;
  sample_count: number;
  average_price_improvement_pct: number;
  selected_for_this_run: boolean;
};

export type EvidenceReportInput = {
  generated_at: string;
  vertical_name: string;
  job: Job;
  sessions: Session[];
  quotes: Quote[];
  ranked: RankedQuote[];
  transcripts: TranscriptEvent[];
  questions_before_booking: BookingQuestion[];
  booking_request_draft: string;
  learning: LearningEvidence[];
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 48;
const RIGHT = 48;
const TOP = 54;
const BOTTOM = 44;

/** Built-in PDF fonts support WinAnsi only; replace smart punctuation safely. */
export function pdfSafe(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = pdfSafe(text).split(/\r?\n/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export async function buildEvidenceReportPdf(
  input: EvidenceReportInput
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage;
  let y: number;
  let pageNumber = 0;

  const addPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    y = PAGE_HEIGHT - TOP;
    page.drawText("LeverageAI - Negotiation Evidence", {
      x: LEFT,
      y,
      size: 9,
      font: bold,
      color: rgb(0.13, 0.39, 0.34),
    });
    page.drawText(`Page ${pageNumber}`, {
      x: PAGE_WIDTH - RIGHT - 36,
      y,
      size: 8,
      font: regular,
      color: rgb(0.42, 0.45, 0.44),
    });
    y -= 24;
  };

  const ensure = (height: number) => {
    if (y - height < BOTTOM) addPage();
  };

  const heading = (text: string, size = 16) => {
    ensure(size + 16);
    page.drawText(pdfSafe(text), {
      x: LEFT,
      y,
      size,
      font: bold,
      color: rgb(0.08, 0.22, 0.19),
    });
    y -= size + 10;
  };

  const paragraph = (
    text: string,
    options?: { bold?: boolean; size?: number; indent?: number; color?: [number, number, number] }
  ) => {
    const size = options?.size ?? 10;
    const font = options?.bold ? bold : regular;
    const indent = options?.indent ?? 0;
    const maxWidth = PAGE_WIDTH - LEFT - RIGHT - indent;
    for (const line of wrap(text, font, size, maxWidth)) {
      ensure(size + 5);
      if (line) {
        page.drawText(line, {
          x: LEFT + indent,
          y,
          size,
          font,
          color: options?.color
            ? rgb(...options.color)
            : rgb(0.13, 0.15, 0.14),
        });
      }
      y -= size + 4;
    }
    y -= 3;
  };

  addPage();
  heading("Negotiation Evidence Bundle", 22);
  paragraph(`${input.vertical_name} | Run ${input.job.id}`, {
    bold: true,
    size: 11,
    color: [0.13, 0.39, 0.34],
  });
  paragraph(`Generated: ${new Date(input.generated_at).toLocaleString("en-US", { timeZone: "UTC" })} UTC`);
  paragraph(
    "This report records observed quotes and call evidence. It is not a purchase, booking, or authorization of work.",
    { bold: true }
  );

  heading("Confirmed request");
  const jobSpec = input.job.frozen_job_spec || input.job.job_spec;
  for (const [key, value] of Object.entries(jobSpec)) {
    if (value == null || String(value).trim() === "") continue;
    paragraph(`${key.replaceAll("_", " ")}: ${String(value)}`, { indent: 8 });
  }

  heading("Provider outcomes");
  if (!input.sessions.length) paragraph("No provider sessions were recorded.");
  for (const session of input.sessions) {
    const ranked = input.ranked.find((item) => item.session_id === session.id);
    const outcome = session.outcome_type?.replaceAll("_", " ") || session.status;
    paragraph(
      `${ranked?.is_winner ? "RECOMMENDED - " : ""}${session.vendor_name}: ${outcome}${ranked ? `, ${money(ranked.total)}` : ""}`,
      { bold: true }
    );
    if (session.audio_url) paragraph(`Recording: ${session.audio_url}`, { indent: 8 });
    else if (session.recording_note) paragraph(session.recording_note, { indent: 8 });
  }

  heading("Observed itemized quotes");
  if (!input.quotes.length) paragraph("No complete persisted quote was captured. No quote was inferred from conversation text.");
  for (const quote of input.quotes) {
    const session = input.sessions.find((item) => item.id === quote.session_id);
    paragraph(`${session?.vendor_name || quote.vendor_id}: ${money(quote.total)}${quote.red_flag ? " - REVIEW FLAG" : ""}`, { bold: true });
    for (const item of quote.line_items) {
      paragraph(`- ${item.label}: ${money(item.amount)}${item.optional ? " (optional)" : ""}`, { indent: 10 });
    }
    if (quote.notes) paragraph(`Notes: ${quote.notes}`, { indent: 10 });
    const evidence = input.ranked.find((item) => item.id === quote.id)?.leverage_chain || [];
    for (const step of evidence) {
      const stamp = `${Math.floor(step.t_ms / 60000)}:${String(Math.floor((step.t_ms % 60000) / 1000)).padStart(2, "0")}`;
      paragraph(`Evidence [${stamp}]: ${step.label}`, { indent: 10, size: 8 });
    }
  }

  heading("Questions before booking");
  if (!input.questions_before_booking.length) {
    paragraph("No configured booking term is missing from the captured quote and transcript evidence.");
  }
  for (const question of input.questions_before_booking) {
    paragraph(`- ${question.question}`, { indent: 8 });
  }

  heading("Learning comparison");
  const observedLearning = input.learning.filter((row) => row.sample_count > 0);
  if (!observedLearning.length) {
    paragraph("No completed-call learning observations exist yet. Tactics remain in controlled exploration.");
  }
  for (const row of input.learning) {
    paragraph(
      `${row.tactic.replaceAll("_", " ")}: ${row.sample_count} observation(s), ${row.average_price_improvement_pct.toFixed(1)}% average improvement${row.selected_for_this_run ? " - selected for this run" : ""}`,
      { indent: 8 }
    );
  }

  heading("Transcript evidence");
  if (!input.transcripts.length) paragraph("No transcript events were captured.");
  for (const event of input.transcripts) {
    const session = input.sessions.find((item) => item.id === event.session_id);
    const stamp = `${Math.floor(event.ts_ms / 60000)}:${String(Math.floor((event.ts_ms % 60000) / 1000)).padStart(2, "0")}`;
    paragraph(`[${stamp}] ${session?.vendor_name || event.session_id} | ${event.speaker}: ${event.text}`, { size: 8 });
  }

  heading("Human handoff draft");
  paragraph(input.booking_request_draft || "No provider is ready for a booking-request draft.");

  return doc.save();
}
