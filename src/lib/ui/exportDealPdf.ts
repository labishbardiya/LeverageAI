/**
 * Client-side printable PDF (browser print → Save as PDF).
 * Human-readable deal summary — no raw JSON dump.
 */

export type DealPdfInput = {
  vertical?: string;
  jobId?: string | null;
  jobSpec?: Record<string, unknown> | null;
  headline: string;
  whyTop: string[];
  others: string[];
  confidence?: number;
  ranked: Array<{
    rank: number;
    name: string;
    total: string;
    note?: string;
    recommended?: boolean;
  }>;
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openDealPdf(input: DealPdfInput): void {
  const rows = input.ranked
    .map(
      (r) => `
      <tr class="${r.recommended ? "win" : ""}">
        <td>#${r.rank}</td>
        <td>${esc(r.name)}${r.recommended ? " ★" : ""}</td>
        <td class="num">${esc(r.total)}</td>
        <td>${esc(r.note || "")}</td>
      </tr>`
    )
    .join("");

  const why = input.whyTop.map((w) => `<li>${esc(w)}</li>`).join("");
  const others = input.others.map((w) => `<li>${esc(w)}</li>`).join("");
  const jobBits = input.jobSpec
    ? Object.entries(input.jobSpec)
        .filter(([, v]) => v != null && String(v).trim() !== "")
        .slice(0, 12)
        .map(([k, v]) => `<span class="chip">${esc(k)}: ${esc(String(v))}</span>`)
        .join(" ")
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>Leverage deal report</title>
<style>
  @page { margin: 18mm; }
  body { font-family: Georgia, "Times New Roman", serif; color: #111; line-height: 1.45; max-width: 720px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 26px; margin: 0 0 6px; letter-spacing: -0.02em; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin: 28px 0 10px; font-weight: 600; }
  .sub { color: #555; font-size: 14px; margin-bottom: 20px; }
  .headline { font-size: 20px; font-weight: 700; margin: 12px 0; }
  ul { padding-left: 1.2em; margin: 8px 0; }
  li { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #e5e5e5; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #666; }
  tr.win { background: #f0faf4; }
  .num { font-variant-numeric: tabular-nums; font-weight: 600; }
  .bar-wrap { height: 10px; background: #eee; border-radius: 999px; overflow: hidden; margin: 8px 0 4px; }
  .bar { height: 100%; background: linear-gradient(90deg, #2d6a4f, #52b788); border-radius: 999px; }
  .chip { display: inline-block; background: #f4f4f1; border-radius: 999px; padding: 3px 10px; margin: 2px 4px 2px 0; font-size: 12px; font-family: system-ui, sans-serif; }
  .foot { margin-top: 32px; font-size: 11px; color: #888; font-family: system-ui, sans-serif; }
  @media print { body { padding: 0; } .noprint { display: none; } }
</style></head><body>
  <p class="noprint" style="font-family:system-ui;font-size:13px;margin-bottom:16px">
    Use <strong>Print → Save as PDF</strong> to download.
  </p>
  <h1>Your deal report</h1>
  <p class="sub">Leverage · ${esc(input.vertical || "job")}${
    input.jobId ? ` · ${esc(input.jobId.slice(0, 8))}…` : ""
  }</p>
  <p class="headline">${esc(input.headline)}</p>
  ${
    typeof input.confidence === "number"
      ? `<h2>Confidence</h2>
  <div class="bar-wrap"><div class="bar" style="width:${Math.min(
    100,
    Math.max(0, input.confidence)
  )}%"></div></div>
  <p class="sub">${input.confidence}% — how complete this comparison felt</p>`
      : ""
  }
  <h2>Why this one</h2>
  <ul>${why || "<li>Best available option from this run.</li>"}</ul>
  <h2>How the others compared</h2>
  <ul>${others || "<li>No other outcomes.</li>"}</ul>
  <h2>Price snapshot</h2>
  <table>
    <thead><tr><th>Rank</th><th>Shop</th><th>Total</th><th>Notes</th></tr></thead>
    <tbody>${rows || "<tr><td colspan=4>No quotes logged</td></tr>"}</tbody>
  </table>
  ${jobBits ? `<h2>Job details</h2><div>${jobBits}</div>` : ""}
  <p class="foot">Generated for a person — not a data dump. Always confirm final written terms with the shop before you book.</p>
  <script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
</body></html>`;

  const w = window.open("", "_blank", "noopener,noreferrer,width=820,height=900");
  if (!w) {
    // popup blocked — download HTML instead
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leverage-deal-report.html";
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
