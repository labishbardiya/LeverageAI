import type { LineItem } from "@/lib/types";
import type { VerticalConfig } from "@/lib/config/loadVertical";

export type QuoteCompleteness = {
  itemized: boolean;
  covered_required: string[];
  missing_required: string[];
  coverage: number;
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * A generic "phone total" is evidence of a price, not an itemized quote.
 * Completeness is evaluated from each vertical's configured categories.
 */
export function assessQuoteCompleteness(
  vertical: VerticalConfig,
  lineItems: LineItem[],
): QuoteCompleteness {
  const labels = lineItems.map((line) => normalized(line.label)).join(" | ");
  const required = vertical.quote_line_items.filter((item) => item.required);
  const covered = required.filter((item) =>
    [item.label, item.id, ...item.aliases]
      .map(normalized)
      .some((alias) => alias && labels.includes(alias)),
  );
  const missing = required.filter((item) => !covered.includes(item));
  const coverage = required.length ? covered.length / required.length : 1;
  return {
    itemized: lineItems.length >= 2 && missing.length === 0,
    covered_required: covered.map((item) => item.id),
    missing_required: missing.map((item) => item.id),
    coverage,
  };
}
