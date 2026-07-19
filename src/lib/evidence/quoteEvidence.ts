import type { Quote, TranscriptEvent } from "@/lib/types";

function escapedNumber(total: number): string {
  const rounded = Math.round(total);
  const formatted = rounded.toLocaleString("en-US").replace(/,/g, "[, ]?");
  return `(?:\\$\\s*)?${formatted}(?:\\.00)?(?:\\s*(?:usd|dollars?))?`;
}

const WORD_VALUES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};

function spokenNumbers(text: string): number[] {
  const tokens = text.toLowerCase().replace(/-/g, " ").match(/[a-z]+/g) || [];
  const out: number[] = [];
  let current = 0;
  let total = 0;
  let active = false;
  const flush = () => {
    if (active) out.push(total + current);
    current = 0;
    total = 0;
    active = false;
  };
  for (const token of tokens) {
    if (token in WORD_VALUES) {
      current += WORD_VALUES[token]!;
      active = true;
    } else if (token === "hundred" && active) {
      current = Math.max(1, current) * 100;
    } else if (token === "thousand" && active) {
      total += Math.max(1, current) * 1000;
      current = 0;
    } else if (token === "million" && active) {
      total += Math.max(1, current) * 1_000_000;
      current = 0;
    } else if (token !== "and") {
      flush();
    }
  }
  flush();
  return out;
}

/**
 * A commercial total becomes visible only after the provider has actually
 * spoken the same numeric amount in the captured call transcript. A tool call
 * or session.current_total alone is never customer-facing evidence.
 */
export function quoteHasSpokenVendorEvidence(
  quote: Quote,
  transcripts: TranscriptEvent[],
): boolean {
  const amount = new RegExp(`(^|[^0-9])${escapedNumber(quote.total)}($|[^0-9])`, "i");
  return transcripts.some(
    (event) =>
      event.session_id === quote.session_id &&
      event.speaker === "vendor" &&
      (amount.test(event.text) || spokenNumbers(event.text).some((value) => value === Math.round(quote.total))),
  );
}

export function evidencedQuotes(
  quotes: Quote[],
  transcripts: TranscriptEvent[],
): Quote[] {
  return quotes.filter((quote) => quoteHasSpokenVendorEvidence(quote, transcripts));
}
