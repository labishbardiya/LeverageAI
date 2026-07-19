#!/usr/bin/env python3
"""
DSPy-style offline learning stub for LeverageAI.

Reads Neon traces (transcript_events, quotes, sessions, jobs) and prints
tactic → price-drop statistics. Optional --write upserts negotiation_learnings.

This is a skeleton — not a full DSPy compile loop. Wire dspy.Module when
you want LLM-optimized tactic phrasing; UCB1 in TypeScript remains the
online selector.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from collections import defaultdict
from typing import DefaultDict, Dict, List, Optional, Tuple

TACTIC_PATTERNS: List[Tuple[str, re.Pattern[str]]] = [
    ("cite_competing_bid", re.compile(r"competing|another (shop|company)|in writing|logged (bid|quote)|I have (a |\$)", re.I)),
    ("cite_benchmark", re.compile(r"fair (band|range|market)|national cost|benchmark|cost guides|typical(ly)? (\$|price)", re.I)),
    ("request_itemization", re.compile(r"itemize|line.?item|break( that)? down|equipment.*labor|permit|haul-?away", re.I)),
    ("ask_for_manager_price", re.compile(r"manager|supervisor|owner price|best (and )?final", re.I)),
    ("bundle_scope_reduction", re.compile(r"if we (skip|remove|drop)|without (the )?pad|scope reduction|basic package", re.I)),
    ("silence_after_anchor", re.compile(r"take( a)? (moment|minute)|I'?ll wait|when you'?re ready", re.I)),
]

PRICE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?)", re.I)


def detect_tactic(text: str) -> Optional[str]:
    for name, pat in TACTIC_PATTERNS:
        if pat.search(text):
            return name
    return None


def parse_prices(text: str) -> List[float]:
    out: List[float] = []
    for m in PRICE_RE.finditer(text or ""):
        raw = (m.group(1) or m.group(2) or "").replace(",", "")
        try:
            n = float(raw)
        except ValueError:
            continue
        if 50 <= n <= 500_000:
            out.append(n)
    return out


def fetch_rows(vertical: str):
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("DATABASE_URL not set — emitting seed demo stats only", file=sys.stderr)
        return None
    try:
        import psycopg
    except ImportError:
        print("psycopg not installed; pip install -r scripts/dspy_train/requirements.txt", file=sys.stderr)
        return None

    sql = """
    SELECT s.id AS session_id, j.vertical, s.vendor_id, s.outcome_type,
           te.speaker, te.text, te.ts_ms, q.total AS quote_total
    FROM sessions s
    JOIN jobs j ON j.id = s.job_id
    LEFT JOIN transcript_events te ON te.session_id = s.id
    LEFT JOIN quotes q ON q.session_id = s.id
    WHERE j.vertical = %s AND s.outcome_type IS NOT NULL
    ORDER BY s.id, te.ts_ms NULLS LAST
    LIMIT 5000
    """
    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, (vertical,))
            cols = [d.name for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def aggregate(rows) -> Dict[str, List[float]]:
    """Map tactic -> list of outcome_delta (negative = good price drop %)."""
    by_session: DefaultDict[str, dict] = defaultdict(lambda: {
        "transcripts": [],
        "quotes": [],
        "vertical": "",
    })
    if not rows:
        # Seed priors matching TypeScript extract.ts
        return {
            "cite_competing_bid": [-14.0] * 6,
            "request_itemization": [-8.0] * 9,
            "cite_benchmark": [-5.0] * 4,
        }

    for r in rows:
        sid = str(r["session_id"])
        by_session[sid]["vertical"] = r.get("vertical") or ""
        if r.get("text"):
            by_session[sid]["transcripts"].append(
                (r.get("speaker") or "", r.get("text") or "", r.get("ts_ms") or 0)
            )
        if r.get("quote_total") is not None:
            by_session[sid]["quotes"].append(float(r["quote_total"]))

    deltas: DefaultDict[str, List[float]] = defaultdict(list)
    for sid, data in by_session.items():
        prices = sorted(set(data["quotes"]))
        if len(prices) < 2:
            # Fallback: prices spoken by vendor in order
            spoken: List[float] = []
            for speaker, text, _ts in sorted(data["transcripts"], key=lambda x: x[2]):
                if speaker in ("vendor", "agent"):
                    spoken.extend(parse_prices(text))
            prices = spoken
        if len(prices) < 2:
            continue
        first, last = prices[0], prices[-1]
        if first <= 0 or last >= first:
            continue
        drop_pct = -((first - last) / first) * 100.0  # negative = good
        # Attribute to last negotiator tactic before end
        nego = [t for t in data["transcripts"] if t[0] == "negotiator"]
        tactic = None
        for _sp, text, _ts in reversed(nego):
            tactic = detect_tactic(text)
            if tactic:
                break
        if tactic:
            deltas[tactic].append(drop_pct)
    return dict(deltas)


def upsert_learnings(vertical: str, deltas: Dict[str, List[float]]) -> None:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit("DATABASE_URL required for --write")
    import psycopg
    import uuid

    with psycopg.connect(url) as conn:
        with conn.cursor() as cur:
            for tactic, samples in deltas.items():
                if not samples:
                    continue
                mean = sum(samples) / len(samples)
                n = len(samples)
                cur.execute(
                    """
                    INSERT INTO negotiation_learnings (id, vertical, tactic, context, outcome_delta, sample_count)
                    VALUES (%s, %s, %s, '{}', %s, %s)
                    ON CONFLICT (vertical, tactic) DO UPDATE
                    SET outcome_delta = (
                          negotiation_learnings.outcome_delta * negotiation_learnings.sample_count
                          + EXCLUDED.outcome_delta * EXCLUDED.sample_count
                        ) / (negotiation_learnings.sample_count + EXCLUDED.sample_count),
                        sample_count = negotiation_learnings.sample_count + EXCLUDED.sample_count,
                        updated_at = now()
                    """,
                    (str(uuid.uuid4()), vertical, tactic, mean, n),
                )
        conn.commit()
    print(f"Wrote {len(deltas)} tactics for vertical={vertical}")


def main() -> None:
    ap = argparse.ArgumentParser(description="LeverageAI DSPy offline stub")
    ap.add_argument("--vertical", default="hvac")
    ap.add_argument("--dry-run", action="store_true", default=True)
    ap.add_argument("--write", action="store_true", help="Upsert negotiation_learnings")
    args = ap.parse_args()

    rows = fetch_rows(args.vertical)
    deltas = aggregate(rows)

    print(f"# Tactic stats vertical={args.vertical}")
    for tactic, samples in sorted(deltas.items(), key=lambda kv: sum(kv[1]) / len(kv[1])):
        mean = sum(samples) / len(samples)
        print(f"  {tactic:28s}  n={len(samples):3d}  mean_delta%={mean:7.2f}")

    if args.write:
        upsert_learnings(args.vertical, deltas)
    else:
        print("\nDry run only. Pass --write to upsert negotiation_learnings.")


if __name__ == "__main__":
    main()
