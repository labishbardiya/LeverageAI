# LeverageAI

### You name the job. We lock the price.

**Your personal AI negotiator for high-stakes services** — one confirmed request, three parallel negotiations, and a recommendation you can defend with evidence.

[![Live demo](https://img.shields.io/badge/Live-leverageai--tawny.vercel.app-black?style=for-the-badge)](https://leverageai-tawny.vercel.app)
[![Product](https://img.shields.io/badge/Open-Close%20Smart%20Deals-0A84FF?style=for-the-badge)](https://leverageai-tawny.vercel.app/livee)
[![Stack](https://img.shields.io/badge/Next.js%2016-·-React%2019-·-ElevenLabs-·-Neon-·-Vercel-111?style=for-the-badge)](https://leverageai-tawny.vercel.app)

---

<p align="center">
  <video
    src="https://github.com/labishbardiya/LeverageAI/raw/main/public/media/final.mp4"
    poster="https://github.com/labishbardiya/LeverageAI/raw/main/public/media/clouds-poster.jpg"
    controls
    playsinline
    preload="metadata"
    width="100%"
  >
    Your browser does not support the video tag.
    <a href="https://leverageai-tawny.vercel.app/media/final.mp4">Watch the demo video</a>
  </video>
</p>

<p align="center">
  <a href="https://leverageai-tawny.vercel.app/media/final.mp4"><strong>▶ Full demo video</strong></a>
  &nbsp;·&nbsp;
  <a href="https://leverageai-tawny.vercel.app"><strong>Live product</strong></a>
  &nbsp;·&nbsp;
  <a href="https://leverageai-tawny.vercel.app/livee"><strong>Close Smart Deals</strong></a>
  &nbsp;·&nbsp;
  <a href="https://leverageai-tawny.vercel.app/live"><strong>Golden replay</strong></a>
</p>

---

## The problem in one breath

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

Voice agents can sound right and still invent numbers, skip fees, or treat a teaser price as a final quote. So the product is built around constraints that are easy to say and hard to implement:

| Principle | What it means in practice |
|-----------|---------------------------|
| **Confirm before action** | No discovery or negotiation until the user freezes the job spec |
| **Quotes are data, not vibes** | Spoken text is not a quote until `log_quote` validates structure, totals, and categories |
| **Leverage must be real** | Competing bids cited in negotiation come only from the database — never invented |
| **Parallel, not sequential** | Three agents run at once against different seller styles |
| **Human closes** | Handoff draft + questions; the product never authorizes work or payment |
| **Evidence or silence** | Missing recordings/quotes are stated explicitly — never faked |

The result is not “AI that talks.” It is **AI that negotiates under rules a judge (or customer) can audit**.

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
- Missing required fields stay blank and visible  

### 2. Human confirmation gate
- You review structured fields before anything runs  
- Confirm freezes the brief so every agent works from the **same truth**  
- Nothing is booked or purchased automatically  

### 3. Discovery & shortlist
- Live local discovery (Google Places when configured; **OpenStreetMap / Nominatim / Overpass** as free path)  
- Providers are scored and shortlisted for the job and location  
- Many candidates can be ranked cheaply; **voice is reserved for the expensive, high-signal stage**  

### 4. Three parallel negotiations
Exactly three deep sessions — the challenge contract and the product sweet spot:

| Style | Role in the system |
|-------|--------------------|
| **Tough seller** | Protects margin; tests pressure and concessions |
| **Stonewaller** | Resists disclosure; tests persistence and structure |
| **Upseller** | Pushes packages; tests scope discipline and fee clarity |

Agents are **prompt-isolated**. They do not share strategies or private pricing logic.

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

## Features at a glance

- **Multimodal intake** — text, voice, document → same structured brief  
- **Config-driven verticals** — HVAC, movers, medical imaging, auto repair (swap JSON, not code)  
- **Parallel ElevenLabs agents** — native turn-taking, live transcripts, tool calling  
- **Server-validated quotes** — categories, totals, red flags, vendor binding  
- **Evidence-only leverage** — `get_competing_bids` returns DB rows only  
- **Live workspace UI** — job · calls · deal on one screen  
- **Market-aware ranking** — reputation, freshness, quote quality, negotiation outcomes  
- **Risk detection** — suspiciously low bids and missing terms become warnings  
- **Constrained learning** — UCB1 improves *tactic selection*; honesty rules stay fixed  
- **Replay path** — deterministic golden demo for stage reliability  
- **No auto-book / no payments** — safe to demo, honest to ship  

---

## Live product map

| Route | What judges see |
|-------|-----------------|
| [`/`](https://leverageai-tawny.vercel.app/) | Marketing landing + product demo video |
| [`/livee`](https://leverageai-tawny.vercel.app/livee) | **Live product** — intake → confirm → discover → 3 chats → deal |
| [`/live`](https://leverageai-tawny.vercel.app/live) | **Golden replay** — stage-safe deterministic path |
| [`/live?vertical=movers`](https://leverageai-tawny.vercel.app/live?vertical=movers) | Config-swap proof (movers vertical) |

> Honesty note for demos: discovery uses **real market data** for call-list realism. The challenge path negotiates against **isolated counter-agents** — not live PSTN calls to real shops. The product never pretends a real business was dialed.

---

## Architecture (simple view of a complex system)

```text
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Next.js UI │────▶│  Orchestration   │────▶│  ElevenLabs Agents │
│  /livee     │     │  XState + APIs   │     │  intake · 3× pairs │
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

**Separation of concerns** (why the system stays auditable):

| Layer | Responsibility |
|-------|----------------|
| UI | One-screen workspace; live status without hiding uncertainty |
| Orchestration | Explicit phases (XState); confirm → discover → negotiate → recommend |
| Agents | Isolated prompts; negotiator vs three counter personas |
| Tools | Server-side only: log quotes, competing bids, job context |
| Evidence | Transcripts, tool events, recordings, export bundle |
| Ranking | Total-value ranking + risk flags |
| Learning | Tactic bandit *outside* safety rules |
| Config | Vertical schemas in `config/verticals/*.json` |

Deep design notes: [docs/ARCHITECTURE_DECISIONS.md](./docs/ARCHITECTURE_DECISIONS.md) · product law: [AGENTS.md](./AGENTS.md)

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
| **Discovery** | Google Places (optional) · OSM Nominatim / Overpass / QLever |
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

Shared application code contains **no hard-coded vertical prices or fee labels**. Swapping config changes product behavior with zero code edits — the multi-vertical claim is architectural, not a UI skin.

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

What the learner **may** improve: which tactics to try more often.  
What it **must never** rewrite: honesty rules, quote validation, job immutability, no-invented-bids.

Autonomy without unbounded freedom — that is the product thesis.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # fill secrets locally — never commit
npm run dev
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | Landing + demo video |
| http://localhost:3000/livee | Live product |
| http://localhost:3000/live | Golden replay |
| http://localhost:3000/live?vertical=movers | Vertical config proof |

### Quality gates

```bash
npm test
npm run eval
npm run smoke
npm run reliability
npm run lint
npm run build
```

### ElevenLabs provisioning (fresh workspace)

Requires a public HTTPS origin (deployed or tunneled):

```bash
npm run provision -- --write-env
npm run provision:verify
```

See [agents/SETUP.md](./agents/SETUP.md). The provisioner never prints API keys or webhook secrets.

---

## Environment (names only)

| Variable | Role |
|----------|------|
| `ELEVENLABS_API_KEY` | Agents platform access |
| `ELEVENLABS_*_AGENT_ID` | Intake, negotiator, tough / stonewaller / upseller (+ counters as configured) |
| `DATABASE_URL` | Neon Postgres (live sessions) |
| `APP_BASE_URL` | Public HTTPS origin for tools & webhooks |
| `TOOLS_WEBHOOK_SECRET` | Authenticates agent tool calls |
| `ELEVENLABS_WEBHOOK_SECRET` | Post-call HMAC verification |
| `BLOB_STORE_ID` / Blob token | Durable recording storage |
| `OSM_*` / Places (optional) | Discovery backends |

All secrets stay in `.env.local` or Vercel — **gitignored**.

---

## Scope boundaries (honest MVP)

| In scope | Out of scope (by design) |
|----------|---------------------------|
| ElevenLabs Agents for all voice | Custom STT/TTS pipelines |
| Parallel counter-agent negotiation | Live PSTN / Twilio dialing (hackathon) |
| Real market discovery for call lists | Pretending real shops were called |
| Evidence export & human handoff | Auto-book, payments, purchase auth |
| Anonymous recent history (limited) | Full multi-user auth product |

---

## Why three agents — not five or fifty?

Discovery can score many providers **without** an LLM.  
Voice is the costly, high-signal stage.

```text
many discovered providers
        ↓ deterministic ranking
three diverse voice negotiations
        ↓
one evidence-backed recommendation
```

Three styles match the challenge contract, control cost and latency, and maximize *information diversity* per credit. A future adaptive fourth call only makes sense when all three outcomes are incomplete or too close — intentionally **not** enabled for the hackathon path.

---

## Repository map

```text
src/                 App Router UI, APIs, orchestration, ranking, evidence
config/verticals/    HVAC · movers · imaging · auto-repair configs
agents/              Isolated agent prompts + setup
public/media/        Landing demo video + brand media
docs/                Architecture decisions & reliability notes
scripts/             eval · smoke · provision · reliability
```

---

## Links

| | |
|--|--|
| **Live** | https://leverageai-tawny.vercel.app |
| **Demo video** | https://leverageai-tawny.vercel.app/media/final.mp4 |
| **Close Smart Deals** | https://leverageai-tawny.vercel.app/livee |
| **Golden replay** | https://leverageai-tawny.vercel.app/live |
| **Challenge law** | [AGENTS.md](./AGENTS.md) |
| **Architecture** | [docs/ARCHITECTURE_DECISIONS.md](./docs/ARCHITECTURE_DECISIONS.md) |
| **Hackathon write-up** | [HACKATHON_SUBMISSION.md](./HACKATHON_SUBMISSION.md) |

---

<p align="center">
  <strong>LeverageAI</strong><br/>
  You name the job. We lock the price.<br/>
  <em>Negotiate with proof — not hope.</em>
</p>
