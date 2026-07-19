"use client";

import { useEffect, useState } from "react";

type Row = {
  tactic: string;
  sample_count: number;
  average_price_improvement_pct: number;
  selected_for_this_run: boolean;
  confidence: number;
  evidence: string;
};

type Props = {
  vertical: string;
  jobId?: string | null;
};

/** Quiet learning strip — no version badges */
export function LearningPanel({ vertical, jobId }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [sentences, setSentences] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/learning?vertical=${encodeURIComponent(vertical)}${jobId ? `&job_id=${encodeURIComponent(jobId)}` : ""}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          comparison?: Row[];
          sentences?: string[];
        };
        if (cancelled) return;
        setRows(data.comparison || []);
        setSentences(data.sentences || []);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId, vertical]);

  if (!rows.length && !sentences.length) return null;

  return (
    <div className="glass-inner p-3.5">
      <p className="label-section">What we learned</p>
      <ul className="mt-2 space-y-1.5">
        {rows.slice(0, 3).map((r) => (
          <li
            key={r.tactic}
            className="flex items-center justify-between gap-2 text-xs text-[var(--ink-secondary)]"
          >
            <span className="font-medium text-[var(--ink)]">
              {r.tactic.replace(/_/g, " ")}
              {r.selected_for_this_run ? " · used" : ""}
            </span>
            <span className="tabular-nums text-[var(--ink-muted)]">
              {r.sample_count > 0
                ? `${r.average_price_improvement_pct.toFixed(1)}% · ${r.sample_count} run${r.sample_count === 1 ? "" : "s"}`
                : "exploring"}
            </span>
          </li>
        ))}
      </ul>
      {sentences[0] && (
        <p className="mt-2 text-[11px] leading-snug text-[var(--ink-muted)]">
          {sentences[0]}
        </p>
      )}
    </div>
  );
}
