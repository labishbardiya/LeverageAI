"use client";

import { useEffect, useState } from "react";

type Row = {
  tactic: string;
  outcome_delta: number;
  sample_count: number;
};

type Props = {
  vertical: string;
};

/** Playbook leaderboard — show after deal on product surface */
export function LearningPanel({ vertical }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [sentences, setSentences] = useState<string[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/learning?vertical=${encodeURIComponent(vertical)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          rows?: Row[];
          sentences?: string[];
          version?: number;
        };
        if (cancelled) return;
        setRows(data.rows || []);
        setSentences(data.sentences || []);
        setVersion(data.version || 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vertical]);

  if (!rows.length && !sentences.length) return null;

  return (
    <div className="glass-inner p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="label-section">Learning</p>
        <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-medium text-[var(--ink-muted)]">
          playbook v{version || 1}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {rows.slice(0, 5).map((r) => (
          <li
            key={r.tactic}
            className="flex items-center justify-between gap-2 text-xs text-[var(--ink-secondary)]"
          >
            <span className="font-medium text-[var(--ink)]">
              {r.tactic.replace(/_/g, " ")}
            </span>
            <span className="tabular-nums text-[var(--ink-muted)]">
              {r.outcome_delta.toFixed(0)}% · n={r.sample_count}
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
