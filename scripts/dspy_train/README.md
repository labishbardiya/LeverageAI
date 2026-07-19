# DSPy offline playbook loop (skeleton)

Offline optimization of negotiation tactics from Neon `transcript_events` +
`quotes` + `negotiation_learnings`. **Not run in the live demo path.**

## Goal

Use [DSPy](https://github.com/stanfordnlp/dspy) (or a tiny custom bandit loop)
to improve tactic selection / phrasing from historical traces:

1. Export closed sessions from Neon (`DATABASE_URL`).
2. Label each session with outcome delta (open price → final price %).
3. Detect tactics in negotiator turns (same regex set as `src/lib/learning/extract.ts`).
4. Fit a policy: which tactic to prefer given vertical + vendor persona.
5. Write aggregated rows back into `negotiation_learnings` (UCB1 arms).

## Prerequisites

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r scripts/dspy_train/requirements.txt
export DATABASE_URL=postgres://...
```

## Skeleton

```bash
python scripts/dspy_train/train_stub.py --vertical hvac --dry-run
```

This stub:

- Connects to Neon if `DATABASE_URL` is set
- Pulls recent closed sessions + transcripts
- Prints tactic → mean Δ% stats
- Does **not** call paid LLMs or overwrite production by default

## Production writeback (optional)

When ready:

```bash
python scripts/dspy_train/train_stub.py --vertical hvac --write
```

Updates `negotiation_learnings` via the same UPSERT semantics as
`src/lib/learning/extract.ts` so the live UCB1 playbook improves without
touching voice agents at runtime.

## Notes

- Keep **honesty**: never inject invented dollar figures into playbook sentences.
- Live path remains: `selectTacticsUcb` → `playbook` dynamic var + bridge kickoff.
