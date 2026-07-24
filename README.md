# LeverageAI

### You name the job. We lock the price.

**Your personal AI negotiator for high-stakes services** — one confirmed request, three parallel negotiations, and a recommendation you can defend with evidence.

[![Live](https://img.shields.io/badge/Live-leverageai--tawny.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://leverageai-tawny.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Agents-0A84FF?style=flat-square)](https://elevenlabs.io)
[![Neon](https://img.shields.io/badge/Neon-Postgres-00E599?style=flat-square&logo=postgresql&logoColor=black)](https://neon.tech)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=flat-square&logo=vercel&logoColor=white)](https://leverageai-tawny.vercel.app)

| | |
|--|--|
| **Live app** | https://leverageai-tawny.vercel.app |
| **Demo video** | https://www.youtube.com/watch?v=m1NqVvy3Emw |
| **Replay (deterministic)** | https://leverageai-tawny.vercel.app/?replay=true |
| **Repository** | https://github.com/labishbardiya/LeverageAI |
| **License** | [MIT](./LICENSE) |

---

<p align="center">
  <a href="https://www.youtube.com/watch?v=m1NqVvy3Emw">
    <img
      src="https://img.youtube.com/vi/m1NqVvy3Emw/maxresdefault.jpg"
      alt="LeverageAI product demo — click to play"
      width="100%"
    />
  </a>
</p>

<p align="center">
  <strong><a href="https://www.youtube.com/watch?v=m1NqVvy3Emw">▶ Watch demo</a></strong>
  &nbsp;·&nbsp;
  <strong><a href="https://leverageai-tawny.vercel.app">Live app</a></strong>
  &nbsp;·&nbsp;
  <strong><a href="https://leverageai-tawny.vercel.app/?replay=true">Replay path</a></strong>
</p>

---

## The problem

It’s 1 AM. Your AC dies. You call the first technician who answers — and you overpay.

That is how almost every high-stakes service gets bought: **HVAC, movers, medical imaging, auto repair**, and more. Quotes are opaque. Line items don’t match. The first offer becomes the only offer. Hidden fees hide in plain sight. Nobody has time to run three real negotiations and keep a paper trail.

**LeverageAI was built for that exact moment.**

---

## What it is

LeverageAI is an **evidence-first AI negotiation system**. You describe a job once — by text, voice, or document. The system structures it, asks you to confirm, discovers real local providers, then runs **three specialized negotiation agents in parallel**. When the rounds close, you get:

- a **decision-ready recommendation** ranked on total value, not sticker price
- **itemized quotes** that only count when they pass server-side validation
- **full evidence** — transcripts, tool events, quotes, and recordings when available
- a **human handoff draft** and questions to ask before booking

**Nothing books. Nothing purchases. You stay in control.**

> **One-liner:** LeverageAI turns one service request into parallel competing offers with full evidence — so you lock a better price without taking the first quote.

---

## Why this is hard (and why it matters)

Most AI demos optimize for a *convincing conversation*.  
LeverageAI optimizes for a **trustworthy decision**.

Voice agents can sound right and still invent numbers, skip fees, or treat a teaser price as a final quote. The product is built around constraints that are easy to say and hard to implement:

| Principle | What it means in practice |
|-----------|---------------------------|
| **Confirm before action** | No discovery or negotiation until the user freezes the job spec |
| **Quotes are data, not vibes** | Spoken text is not a quote until `log_quote` validates structure, totals, and categories |
| **Leverage must be real** | Competing bids cited in negotiation come only from the database — never invented |
| **Parallel, not sequential** | Three agents run at once against different seller styles |
| **Human closes** | Handoff draft + questions; the product never authorizes work or payment |
| **Evidence or silence** | Missing recordings/quotes are stated explicitly — never faked |

The result is not “AI that talks.” It is **AI that negotiates under rules a customer (or investor) can audit**.

---

## Product walkthrough

```text
  Describe job          Confirm spec           Discover & score
  text · voice · PDF  →  freeze + hash       →  real local market
                                                    │
                                                    ▼
                         ┌────────── parallel negotiations ──────────┐
                         │  Tough seller │ Stonewaller │ Upseller    │
                         └──────────────────┬────────────────────────┘
                                            ▼
                         Validate quotes → Rank total value → Evidence bundle
                                            ▼
                         Recommendation · questions · handoff · export
```

### 1. Intake (one job, many inputs)

- **Text**, **voice** (ElevenLabs intake agent), or **PDF/TXT** upload
- Parsed into a config-defined `job_spec` for the active vertical
- Missing required fields stay blank and visible — never silently invented

### 2. Human confirmation gate

- You review structured fields before anything runs
- Confirm freezes the brief so every agent works from the **same truth**
- Nothing is booked or purchased automatically

### 3. Discovery & shortlist

- Live local discovery (Google Places when configured; **OpenStreetMap / Nominatim / Overpass** as free path)
- Providers are scored and shortlisted for the job and location
- Many candidates can be ranked cheaply; **voice is reserved for the expensive, high-signal stage**

### 4. Three parallel negotiations

Exactly three deep sessions — the product sweet spot for cost, latency, and information diversity:

| Style | Role in the system |
|-------|--------------------|
| **Tough seller** | Protects margin; tests pressure and concessions |
| **Stonewaller** | Resists disclosure; tests persistence and structure |
| **Upseller** | Pushes packages; tests scope discipline and fee clarity |

Agents are **prompt-isolated**. They do not share strategies or private pricing logic. Counter-agents never receive database tools.

### 5. Evidence-only outcomes

Each call ends as one of:

- `itemized_quote`
- `callback_commitment`
- `documented_decline`

Only **persisted, itemized** quotes enter ranking. Fee-risk outliers and incomplete scopes are flagged, not crowned.

### 6. Recommendation & close

- Rank by **total value**, not cheapest headline
- Questions to ask before booking
- Human-review handoff draft you send yourself
- Portable **evidence ZIP** (PDF report, transcripts, quotes, events, learning comparison, booking request text)

---

## Features

- **Multimodal intake** — text, voice, document → same structured brief
- **Config-driven verticals** — HVAC, movers, medical imaging, auto repair (swap JSON, not code)
- **Parallel ElevenLabs agents** — native turn-taking, live transcripts, tool calling
- **Server-validated quotes** — categories, totals, red flags, vendor binding
- **Evidence-only leverage** — `get_competing_bids` returns DB rows only
- **Live workspace UI** — job · calls · deal on one screen
- **Market-aware ranking** — reputation, freshness, quote quality, negotiation outcomes
- **Risk detection** — suspiciously low bids and missing terms become warnings
- **Constrained learning** — UCB1 improves *tactic selection*; honesty rules stay fixed
- **Replay path** — deterministic golden demo for reliable demos
- **No auto-book / no payments** — safe to demo, honest to ship

---

## Architecture

```text
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Next.js UI │────▶│  Orchestration   │────▶│  ElevenLabs Agents │
│  workspace  │     │  XState + APIs   │     │  intake · 3× pairs │
└─────────────┘     └────────┬─────────┘     └─────────┬──────────┘
                             │                         │
                    ┌────────▼────────┐       tools · webhooks · transcripts
                    │ Neon Postgres   │
                    │ jobs · quotes · │
                    │ sessions · logs │
                    └────────┬────────┘
                             │
                    ranking · evidence ZIP · learning (UCB1)
```

### Layers

| Layer | Responsibility |
|-------|----------------|
| UI | One-screen workspace; live status without hiding uncertainty |
| Orchestration | Explicit phases (XState): confirm → discover → negotiate → recommend |
| Agents | Isolated prompts; negotiator vs three counter personas |
| Tools | Server-side only: log quotes, competing bids, job context, close session |
| Evidence | Transcripts, tool events, recordings, export bundle |
| Ranking | Total-value ranking + risk flags |
| Learning | Tactic bandit *outside* safety rules |
| Config | Vertical schemas in `config/verticals/*.json` |

### Design decisions (summary)

| Decision | Rationale |
|----------|-----------|
| **Broad discovery, three deep negotiations** | Discovery is cheap; live voice is the dominant cost. Three seller styles maximize behavioral diversity per credit. |
| **Real discovery, simulated counter-parties (MVP)** | Call lists come from Places/OSM. Negotiations use isolated counter-agents for reliability, cost, and legal clarity. UI does not claim real shops were dialed. |
| **Deterministic intake + human confirm** | Invented tonnage, body part, or ZIP corrupts every later quote. Missing fields stay blank until the user freezes the spec. |
| **Workspace tools, not inline prompt tools** | Tools are provisioned via ElevenLabs workspace APIs and attached by ID so prompts and tool graphs stay source-controlled and idempotent. |
| **Server-side evidence is truth** | Transcript price mentions are not quotes. A quote exists only after `log_quote` validates linkage, line items, totals, categories, and red flags. |
| **Fixed safety, adaptive tactics** | UCB1 may improve *which tactics to try*. It must never rewrite honesty rules, validation, or job immutability. |
| **Anonymous local history, no accounts (MVP)** | Last few jobs in `localStorage`; durable evidence in Neon by unguessable UUID. |
| **Human handoff, never auto-purchase** | Questions + booking draft only. No payment or booking API. |
| **Evidence ZIP + signed post-call webhooks** | Portable audit trail; HMAC-verified ingestion; missing audio reported, never faked. |
| **Network dependencies degrade** | Discovery timeouts, parallel Overpass mirrors, cache by vertical + ZIP. |

### Why three agents — not five or fifty?

```text
many discovered providers
        ↓ deterministic ranking
three diverse voice negotiations
        ↓
one evidence-backed recommendation
```

Discovery scores many providers without an LLM. Voice is the costly, high-signal stage. Three styles control cost and latency while maximizing *information diversity* per credit. An adaptive fourth call only makes sense when all three outcomes are incomplete or too close — not enabled in the default product path.

---

## Tech stack

| Area | Choice |
|------|--------|
| **App** | Next.js 16 (App Router), React 19, TypeScript |
| **UI** | Tailwind CSS 4, single-screen live workspace |
| **State** | XState for explicit negotiation workflow |
| **Voice** | ElevenLabs Agents (intake + negotiator + 3 counter-agents) |
| **Data** | Neon Postgres (`pg`), memory fallback for tests/demos |
| **Validation** | Zod end-to-end on specs, quotes, tools |
| **Discovery** | Google Places (optional) · OSM Nominatim / Overpass |
| **Storage** | Vercel Blob for durable recordings |
| **Exports** | `pdf-lib`, JSZip evidence bundles |
| **Deploy** | Vercel Functions + managed env |
| **Quality** | `npm test` · `npm run eval` · `npm run smoke` · `npm run reliability` |

---

## Verticals

All vertical-specific fields, benchmarks, red flags, quote categories, booking terms, discovery filters, and negotiation levers live in:

```text
config/verticals/
  hvac.json
  movers.json
  medical-imaging.json
  auto-repair.json
```

Shared application code contains **no hard-coded vertical prices or fee labels**. Swapping config changes product behavior with zero code edits — multi-vertical is architectural, not a UI skin.

Default vertical is HVAC. Switch with `?vertical=movers` (and other vertical keys as configured).

---

## Evidence bundle

`GET /api/jobs/:id/evidence` returns a ZIP with:

| Artifact | Contents |
|----------|----------|
| `report.pdf` | Human-readable decision report |
| `transcripts.json` / `.md` | Full conversation record |
| `quotes.json` | Validated itemized quotes only |
| `recordings.json` | Links when capture succeeded |
| `tool-events.json` | Audit trail of agent tools |
| `learning-comparison.json` | Tactic selection vs outcomes |
| `booking-request.txt` | Draft you send yourself |
| `manifest.json` | Bundle integrity index |

If a quote or recording is missing, the report **says so**. It never invents completeness.

---

## Learning loop (constrained on purpose)

After closed sessions, deterministic tactic detection records what was tried and whether price moved. A **UCB1 bandit** balances exploration vs exploitation **within a vertical**.

| May improve | Must never rewrite |
|-------------|-------------------|
| Which tactics to try more often | Honesty rules, quote validation, job immutability, no-invented-bids |

Autonomy without unbounded freedom — that is the product thesis.

An offline analysis stub lives in `scripts/dspy_train/` for experiment notebooks; online selection remains the TypeScript UCB1 path.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill secrets locally — never commit
npm run dev
```

Open the local Next.js URL, or use the **live deployment**: https://leverageai-tawny.vercel.app

### Quality gates

```bash
npm test
npm run eval
npm run smoke
npm run reliability
npm run lint
npm run build
```

### Manual smoke checks (honesty)

1. **Missing facts** — vague job text must surface required fields (symptom, urgency, ZIP), not invent them.
2. **Invalid ZIP** — non–five-digit ZIP blocks confirmation.
3. **No fake leverage** — with no stored competitor quote, the negotiator must not claim one.
4. **Bad arithmetic** — `log_quote` rejects totals that don’t match line items.
5. **No auto-purchase** — requests to pay/book are refused; human review is required.

### ElevenLabs provisioning (fresh workspace)

Requires a public HTTPS origin (deployed or tunneled — `localhost` cannot receive webhooks):

```bash
npm run provision -- --write-env
npm run provision:verify
```

The provisioner is idempotent (`leverageai-*` names). It:

1. Validates the conversational model (prefers current flash models; override with `ELEVENLABS_LLM_ID`)
2. Creates/updates workspace tools from `agents/tool-schemas.json`
3. Generates `TOOLS_WEBHOOK_SECRET` when absent
4. Creates/updates five agents: intake, negotiator, tough, stonewaller, upseller
5. Attaches tools by ID (not legacy inline prompt tools)
6. Configures signed post-call webhook at `/api/webhooks/elevenlabs`
7. Enables focus / prompt-injection guardrails and verifies remote prompts match source
8. Writes agent IDs and secrets to `.env.local` **without printing them**

| Agent | Tools |
|-------|--------|
| Intake | `submit_spec` |
| Negotiator | `log_quote`, `get_competing_bids`, `lookup_benchmark`, `close_session` |
| Tough / Stonewaller / Upseller | none |

Post-call webhooks validate `ElevenLabs-Signature` (HMAC, constant-time), resolve the session, deduplicate retries, and store negotiator-side audio when Blob is configured. Without Blob on Vercel, the product records an explicit transcript-only note rather than faking audio.

---

## Environment (names only)

| Variable | Role |
|----------|------|
| `ELEVENLABS_API_KEY` | Agents platform access |
| `ELEVENLABS_*_AGENT_ID` | Intake, negotiator, tough / stonewaller / upseller |
| `DATABASE_URL` | Neon Postgres (live sessions) |
| `APP_BASE_URL` | Public HTTPS origin for tools & webhooks |
| `TOOLS_WEBHOOK_SECRET` | Authenticates agent tool calls |
| `ELEVENLABS_WEBHOOK_SECRET` | Post-call HMAC verification |
| `BLOB_STORE_ID` / Blob token | Durable recording storage |
| `OSM_*` / Places (optional) | Discovery backends |

All secrets stay in `.env.local` or Vercel — **gitignored**. See `.env.example` for the full template.

---

## Scope (honest MVP)

| In scope | Out of scope (by design) |
|----------|---------------------------|
| ElevenLabs Agents for all voice | Custom STT/TTS pipelines |
| Parallel counter-agent negotiation | Live PSTN / carrier dialing (roadmap) |
| Real market discovery for call lists | Claiming real shops were contacted |
| Evidence export & human handoff | Auto-book, payments, purchase auth |
| Anonymous recent history (limited) | Full multi-user auth product |

---

## Repository map

```text
src/                 App Router UI, APIs, orchestration, ranking, evidence
config/verticals/    HVAC · movers · imaging · auto-repair configs
agents/              Isolated prompts, tool schemas, reliability cases
public/media/        Landing demo video + brand media
scripts/             eval · smoke · provision · reliability · offline train stub
LICENSE              MIT
```

---

## Acknowledgments

Built with [ElevenLabs Agents](https://elevenlabs.io), [Neon](https://neon.tech), [Next.js](https://nextjs.org), and [Vercel](https://vercel.com). Optional discovery via Google Places and OpenStreetMap / Nominatim / Overpass. Pretrained conversational models are provided by the voice platform; orchestration, validation, ranking, evidence, UI, and vertical configs are this project’s implementation.

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

<p align="center">
  <strong>LeverageAI</strong><br/>
  You name the job. We lock the price.<br/>
  <em>Negotiate with proof — not hope.</em>
</p>
