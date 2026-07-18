# LeverageAI

> *The AI that picks up the phone so you don’t overpay.*

Hack-Nation Challenge 01 · **ElevenLabs** · “The Negotiator” track — voice agent that phone-shops and haggles quotes end-to-end on **one screen**.

**Primary vertical:** HVAC (broken AC / 3-ton replacement)  
**Config-swap proof:** movers via `?vertical=movers` — zero code changes.

Standing law: [`AGENTS.md`](./AGENTS.md) — every agent and contributor must obey it.

---

## What judges see (one screen)

| Column | Zone | Purpose |
|--------|------|---------|
| 1 | **YOUR JOB** | Voice intake or PDF → job-spec card → **Looks right — get me quotes** |
| 2 | **THE CALLS** | 3 live (or replay) negotiations · price ticks · transcript ticker |
| 3 | **YOUR DEAL** | Ranked report · red-flag bait prices never #1 · transcript evidence |

---

## Quick start (demo-ready without ElevenLabs)

```bash
cd the-negotiator
cp .env.example .env.local   # optional for replay-only
npm install
npm run dev
```

Open:

- **Golden demo (recommended on stage):**  
  [http://localhost:3000/?replay=true](http://localhost:3000/?replay=true)
- **Movers config swap:**  
  [http://localhost:3000/?vertical=movers&replay=true](http://localhost:3000/?vertical=movers&replay=true)
- **Live path (needs agents + optional DB):**  
  [http://localhost:3000](http://localhost:3000) → *Use demo job* → confirm

```bash
npm run eval          # 5 acceptance assertions on golden run
npx tsx scripts/smoke-tools.ts   # tool honesty + ranking smoke
```

---

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `ELEVENLABS_API_KEY` | For live voice | ElevenLabs API |
| `ELEVENLABS_INTAKE_AGENT_ID` | Live intake | Agent #1 |
| `ELEVENLABS_NEGOTIATOR_AGENT_ID` | Live calls | Agent #2 |
| `ELEVENLABS_TOUGH_AGENT_ID` | Live calls | Counter-agent #3 (Summit Air) |
| `ELEVENLABS_STONEWALLER_AGENT_ID` | Live calls | Counter-agent #4 (ComfortPro) |
| `ELEVENLABS_UPSELLER_AGENT_ID` | Live calls | Counter-agent #5 (ValueHVAC) |
| `NEXT_PUBLIC_ELEVENLABS_INTAKE_AGENT_ID` | Browser mic | Same as intake id if widget used client-side |
| `DATABASE_URL` | Optional | Neon Postgres; **in-memory fallback** if unset |
| `NEXT_PUBLIC_DEFAULT_VERTICAL` | Optional | Default `hvac` |

Never commit secrets. Use `.env.local` (gitignored).

---

## Create the 5 ElevenLabs agents (human parallel track)

Full runbook: **[`agents/SETUP.md`](./agents/SETUP.md)**

| # | Role | Prompt file | Tools |
|---|------|-------------|-------|
| 1 | Intake | `agents/prompts/intake.md` | `submit_spec` |
| 2 | Negotiator | `agents/prompts/negotiator.md` | `log_quote`, `get_competing_bids`, `lookup_benchmark`, `close_session` |
| 3 | Tough | `agents/prompts/counter-agents/tough.md` | none |
| 4 | Stonewaller | `agents/prompts/counter-agents/stonewaller.md` | none |
| 5 | Upseller | `agents/prompts/counter-agents/upseller.md` | none |

**Isolation law:** never merge negotiator + counter-agent prompts. Counter pricing floors are secret.

Tool JSON schemas: `agents/tool-schemas.json`  
Webhook base: `https://YOUR_HOST/api/tools/*` (or localhost via tunnel for dashboard tools).

---

## Architecture (short)

```
[ One screen UI ]
      │
      ├─ POST /api/jobs → confirm → POST /api/sessions/start (3 vendors from config)
      │
      ├─ Negotiator ×3  ←→  Counter-agents (ElevenLabs only; no custom STT/TTS)
      │       tools → log_quote / get_competing_bids / lookup_benchmark / close_session
      │
      └─ GET /api/jobs/:id/state  (poll 1s) or GET /api/events?job_id= (SSE)
```

- Verticals: `/config/verticals/hvac.json`, `movers.json` — **no hardcoded prices in UI code**
- Honesty: leverage only via `get_competing_bids` (real DB rows)
- Outcomes: `itemized_quote` | `callback_commitment` | `documented_decline`
- Replay insurance: `?replay=true` streams `data/golden/run.json` through the same UI pipeline

---

## Postgres (optional)

```bash
psql "$DATABASE_URL" -f scripts/migrate.sql
```

Without `DATABASE_URL`, the app uses an in-memory store (fine for demo + smoke).

---

## Golden run / recorder

- Canonical payload: `data/golden/run.json` (synced under `public/golden/` for static fallback)
- Proves: price drop after real competing bid, AI disclosure, stonewaller decline + callback, upseller itemized fees + red flag, frozen job_spec
- Eval: `npm run eval` → 5/5 PASS required before submit

To “record” a live run later: export job state JSON into the same shape as `data/golden/run.json` (sessions + price_history + transcript_events + ranked_report).

---

## 60-second demo click-path (stage)

1. Open `http://localhost:3000/?replay=true`
2. **JOB** auto-fills demo 3-ton AC replacement → calls start
3. **CALLS:** watch Summit Air price **tick down** after “Competing bid used”; ComfortPro **declines** with callback; ValueHVAC fees **itemize**
4. **DEAL:** green recommendation on fair quote; red **bait-price** banner on ≥30% below market (never #1); click **Listen** / **Download transcript**
5. Optional wow: open `?vertical=movers&replay=true` — different vendors/fields, **zero code change**

### Pitch numbers (from brief + HVAC demo)

- Same job, wild phone spreads; sight-unseen quotes blow up  
- Demo: **$9,400 → $7,850** because of a **logged** competing bid — not a scripted TTS play  
- Red-flag rule: **≥30% below market = warning, not winner**

---

## Acceptance tests (Definition of Done)

1. Intake (voice or PDF) → valid job_spec → user confirms before calls  
2. 3 sessions vs 3 counter-agents; live or replay transcripts in UI  
3. ≥1 mid-call price drop after citing a real competing bid  
4. Stonewaller → `documented_decline` + callback; upseller fees itemized  
5. Report ranks, red-flags ≥30% below benchmark, transcript timestamps  
6. `movers.json` ↔ `hvac.json` swap via `?vertical=` with zero code edits  

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local app |
| `npm run build` | Production build |
| `npm run eval` | Golden-run assertions |
| `npx tsx scripts/smoke-tools.ts` | Tool + ranking smoke |

---

## Explicit exclusions

No Twilio/real phones, no auth, no payments, no mobile layout, no multi-page nav, no vendor discovery API (3 vendors from config; Places stub can live as a comment in config only).
