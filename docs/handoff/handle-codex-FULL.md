# handle-codex.md — COMPLETE LeverageAI handoff for Codex 5.6

> **Save location:** `~/Desktop/handle-codex.md`  
> **Also in repo:** `the-negotiator/HANDOFF_CODEX.md` (shorter) + `docs/handoff/`  
> **Author context:** SuperGrok / Grok Build TUI session with Labish Bardiya  
> **Generated:** 2026-07-19  
> **Purpose:** Zero information loss when leaving SuperGrok for Codex 5.6.  
> **Codex instruction:** Read this entire file before any product change. Do not reinvent. Continue.

---

# PART 0 — How to use this file in Codex

```bash
cd /Users/labishbardiya/Desktop/the-negotiator
# Open Codex 5.6 in this directory
```

First message to Codex:

```
Read ~/Desktop/handle-codex.md completely (and HANDOFF_CODEX.md in the repo).
Continue LeverageAI from SuperGrok. Do not rewrite the product from scratch.
Confirm understanding in bullets, then wait for my next task.
```

**MCP vs memory:** Re-add Neon/other MCP servers in Codex for *tools*. This file is the *brain*. MCP alone does not transfer chat history.

---

# PART 1 — People, event, mission

## 1.1 Owner
- **Name:** Labish Bardiya  
- **Location:** Jaipur, Rajasthan  
- **Site:** labishbardiya.com  
- **GitHub:** labishbardiya  
- **Email (portal/Git):** labishjain7@gmail.com / Labishjain7@gmail.com  
- **Role:** Solo founder-operator; SuperGrok was primary AI co-founder for this build  

## 1.2 Event
- **Hack-Nation** 6th Global AI Hackathon  
- **Dates (memory):** Jul 18–19 2026 · iWorkk Gurgaon  
- **Challenge:** Challenge 01 — ElevenLabs track  
- **Product name:** **LeverageAI** (also “The Negotiator” in AGENTS.md)  
- **GitHub repo:** https://github.com/labishbardiya/LeverageAI  
- **Local path:** `/Users/labishbardiya/Desktop/the-negotiator`  
- **Production:** https://leverageai-tawny.vercel.app  
- **Vercel project:** leverageai (Hobby plan; maxDuration 300s)  

## 1.3 Mission statement (product)
Users facing high-stakes service purchases (HVAC replacement, movers, MRI cash price, auto repair) cannot call 10 shops and negotiate. LeverageAI:
1. Collects requirements (text / voice / document)
2. Finds local providers from the user’s **real location**
3. Runs **three parallel AI negotiations** (negotiator vs three vendor personas)
4. Compares quotes, detects bait prices, applies competing-bid leverage
5. Returns **exactly one recommended deal** with plain-language reasoning
6. Exports a human-readable PDF report

**Pitch narrative (user-provided style):**
> It is 1 pm Tuesday in July. You work from home with calls until 5. Mid-call AC dies. Office becomes an oven. You pause everything, call the first tech you find, overpay. To avoid calling 10 people, LeverageAI negotiates for you.

---

# PART 2 — Standing law (AGENTS.md summary — full file is law)

Path: `AGENTS.md` in repo root. **This file wins over any task prompt.**

### Non-negotiables
1. **Voice = ElevenLabs Agents ONLY** — no custom STT/TTS, no other voice vendors  
2. **Config-driven verticals** — all vertical numbers/personas in `config/verticals/*.json`  
3. **Prompt isolation** — negotiator never sees counter-agent secret pricing strategies  
4. **Honesty** — `get_competing_bids` only returns real DB quotes; never invent bids  
5. **Structured outcomes only:** `itemized_quote` | `callback_commitment` | `documented_decline`  
6. **Stack:** Next.js + TS + Tailwind + Neon Postgres + ElevenLabs  
7. **No auth, payments, mobile app** (hackathon scope)  
8. **Secrets only in env** — never commit  

### Acceptance tests (eval / definition of done)
1. Intake (voice OR PDF/text) → valid `job_spec` → user confirm before sessions  
2. 3 simultaneous negotiations; transcripts to UI  
3. At least one price drop after real competing bid  
4. Stonewaller → decline/callback; upseller fees itemized  
5. Report ranks; red-flag ≥30% under benchmark never #1  
6. Swap vertical JSON changes behavior with zero code edits  

### Explicitly out of scope later decisions
- Real Twilio/PSTN (was scaffolded then **removed** by Labish due to time/cost/TCPA)  
- xAI/Grok opinion voice (removed from product path)  
- Google Places paid key optional; free OSM path required  

---

# PART 3 — Chronological build history (initial → last SuperGrok prompt)

This is the narrative of *what Labish asked for* and *what was built*, in order. Codex must not “undo” these without explicit ask.

### Phase A — Select problem & foundation
- Hack-Nation PS selection → Negotiator / ElevenLabs track  
- Full app scaffold: Next.js App Router, Neon, Vercel  
- Agents: intake, negotiator, tough, stonewaller, upseller  
- Tools: log_quote, close_session, get_competing_bids, lookup_benchmark, submit_spec  
- Vertical configs: HVAC primary; movers; later medical-imaging, auto-repair  

### Phase B — Make it functional, not demo-only
- Labish: *“I wanna make everything functional not just demo ready because I will be showing them live it works as well.”*  
- Fixed `?replay=true` React cancel bug (startMock cancelled on phase change)  
- Default reliable path: **server-side `simulateJobNegotiations`** writing real Neon rows  
- Optional live: `?live=1` / later default prefer live when agents configured  
- `maxDuration` 300 for Vercel Hobby  

### Phase C — Multi-agent orchestration + review
- Labish: agents not simultaneous → **`Promise.all` parallel bridges**  
- Review layer `buildDealReview` → “Your deal” with layman why  
- Removed internal `[bridge] kickoff` system messages from chat UI  
- Discussed DSPy / learning for improve-with-usage  

### Phase D — Google products / phone / stack Q&A
- **Places API (New)** for GMB-style ratings (not Maps JS)  
- Phone: Twilio + ElevenLabs outbound **scaffolded then dropped**  
- Final stack documented  
- Four-agent bug hunts  

### Phase E — UI evolution (many iterations)
1. Glass Mac panels + Sarvam ambient  
2. Remove Architecture button  
3. Splash Leverage.AI logo then main  
4. True Apple glass + WhatsApp chats  
5. Multi-agent audit → functional paths  
6. Intro video (later **gitignored**, not for GitHub)  
7. Claude-style clean UI: center input, modes dropdown, deal below chats  
8. Landing inspired by tryclean.ai: black frame, cloud bg (not mountain)  
9. LEVERAGE wordmark, Instrument Serif, liquid glass  
10. Sample only at `/live` URL; main product `/` + `/livee`  
11. Upload → `+`; Talk → mic; no Sample button in UI  
12. Always one deal; PDF export; Top3 map; progress bar  
13. Live location discovery (stop hardcoded 28202 Charlotte on live)  
14. Header alignment home vs live; remove A logo mark  
15. Liquid glass Close Smart Deals buttons; italic *name* / *lock*  
16. SuperGrok → Codex handoff pack  

### Phase F — Pain points Labish was “very very upset” about
- Hardcoded ZIP 28202 / Charlotte discovery on live runs when user said Chicago  
- Fix: geocode user text → Places or OSM Overpass; snapshot only if geocode fails; never wrong-city  
- Agents looping, partial “Hello…”, tools spoken aloud not invoked → bridge debounce + prompt rewrites + force close  
- Deal stuck “waiting” when tools don’t fire → transcript fallback + always one pick  
- Voice not filling input → fill composer from intake draft; user presses Send  

---

# PART 4 — Current product surface (routes & UX)

## 4.1 Routes

| Path | Component | Role |
|------|-----------|------|
| `/` | `LandingPage` via `AppHome` | Marketing landing |
| `/livee` | `ProductWorkspace` | Live product portal |
| `/live` | `LiveSampleClient` → dashboard + forced `replay=true` | Golden insurance |
| `/demo` | redirects toward live sample | Legacy |
| `/architecture` | **removed** (redirect to `/`) | Gone |
| `/api/*` | Route handlers | Backend |

## 4.2 Landing (`/`)
- Black outer frame, large border-radius (Clean-style)  
- Cloud **video** + CSS clouds (`public/media/clouds-loop.mp4`, poster)  
- Shared `SiteHeader`: **LEVERAGE** left (Instrument Serif, **no A icon**), **Close Smart Deals** liquid-glass button right  
- Headline:  
  - You *name* the job.  
  - We *lock* the price.  
  - Extra spacing after italic words  
- Hero CTA: liquid-glass **Close Smart Deals** button → `/livee`  
- Demo video blank section (~1.3× larger, responsive) — asset not dropped yet  

## 4.3 Portal (`/livee`)
- Same outer frame + cloud video  
- Same LEVERAGE header position (`SiteHeader` logo links home)  
- Headline same italic name/lock when idle  
- Composer:
  - Typewriter placeholders (3–4 lines per vertical, ~2.5s hold)  
  - **+** upload (doc/image)  
  - **Mic** voice (not “Talk to Leverage” text)  
  - Mode dropdown (HVAC / Local move / Cash MRI / Auto repair) **immediately left of Send**  
  - **Send** solid button aesthetic  
  - **No Sample button** in UI  
- After Send: status strip + **green progress bar** tied to agent stages  
- Discovery panel (ranked locals)  
- Three liquid-glass chat cards (soft blue glass over white)  
- **Top3Map** under chats (OSM embed + list)  
- Deal section: always one pick; Export PDF; learning strip without “playbook v2” badge  

## 4.4 Copy rules Labish enforced
- Not: “Better deals. Less phone tag.” as final (replaced)  
- Not: “One job. Three shops. One clear pick.” on site (removed)  
- Voice status: multi-agent mode; speak with Leverage we close the deal — not long “window opened” copy  
- Mode label: **HVAC** not “Home AC”  

---

# PART 5 — Full tech stack

### Frontend
- Next.js **16.2.10** App Router  
- React **19.2.4**  
- TypeScript 5  
- Tailwind CSS 4  
- Fonts: Inter (body), **Instrument Serif** (logo + headlines) via `next/font`  

### Backend
- Next.js Route Handlers, Node runtime  
- Zod validation  
- `@vercel/functions` `waitUntil` for background bridges/simulate  
- `ws` for ElevenLabs WebSocket bridges  

### Data
- Neon Postgres (`pg`)  
- Schema: jobs, sessions, quotes, transcript_events, tool_calls, intake_drafts, negotiation_learnings, providers (cache)  
- Memory store fallback without DATABASE_URL (local only; prod needs Neon)  

### Agents
- ElevenLabs Conversational AI  
- Provision: `npm run provision` / `scripts/provision-agents.ts`  
- Prompts: `agents/prompts/*.md`  
- Tools webhook auth: optional `TOOLS_WEBHOOK_SECRET` via `x-tools-secret`  

### Orchestration & learning
- XState v5 `jobMachine` + `src/lib/orchestrator/runtime.ts`  
- Parallel bridges + parallel simulate  
- UCB1 bandit on tactics (`src/lib/learning/bandit.ts`)  
- Tactic detect + upsert on session close  
- DSPy: offline stub only (`scripts/dspy_train/`)  

### Discovery & ranking
- Nominatim geocode  
- Google Places API (New) if key  
- OSM Overpass if no Places key  
- ProviderScore Bayesian ranking  
- Red-flag rules from vertical JSON  

### Deploy
- Vercel project `leverageai`  
- Hobby: maxDuration 300  
- Env in Vercel dashboard + local `.env.local`  

### Explicitly removed
- `src/lib/telephony/*`  
- `scripts/provision-phone.ts`  
- GrokOpinion product path (stub returns null)  
- xAI vision required path (heuristics primary)  

---

# PART 6 — Environment variables (names + meaning)

### Required for production live agents
| Variable | Purpose |
|----------|---------|
| `ELEVENLABS_API_KEY` | API auth |
| `ELEVENLABS_INTAKE_AGENT_ID` | Voice intake agent |
| `ELEVENLABS_NEGOTIATOR_AGENT_ID` | Buyer negotiator |
| `ELEVENLABS_TOUGH_AGENT_ID` | Counter tough (aliases `*_COUNTER_*` accepted) |
| `ELEVENLABS_STONEWALLER_AGENT_ID` | Counter stonewaller |
| `ELEVENLABS_UPSELLER_AGENT_ID` | Counter upseller |
| `DATABASE_URL` | Neon connection string |
| `APP_BASE_URL` | `https://leverageai-tawny.vercel.app` for tool webhooks |

### Public / optional
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_ELEVENLABS_INTAKE_AGENT_ID` | Browser awareness |
| `NEXT_PUBLIC_DEFAULT_VERTICAL` | default `hvac` |
| `GOOGLE_PLACES_API_KEY` | **MISSING on prod** — enable Places API (New) |
| `TOOLS_WEBHOOK_SECRET` | Tool webhook auth |
| `BLOB_READ_WRITE_TOKEN` | Optional recordings |
| `XAI_API_KEY` | Optional; not core |

### Known agent IDs (from prod `/api/status` — still need dashboard prompt/tool sync)
- intake: `agent_7801kxvmsyedf9ksnn4jwfhax5we`  
- negotiator: `agent_6901kxvmszydf36sztc11hcbg3eg`  
- tough: `agent_9001kxvmt1f1ecc9ag21tkvbgy61`  
- stonewaller: `agent_3301kxvmt30wewaanp4xv1wsd9hz`  
- upseller: `agent_4501kxvmt4b1e7p98hmvqdzfaz0s`  

**Secrets live in:** `.env.local` (gitignored) and Vercel env — never commit.

---

# PART 7 — Data model & tools

### Entities
- **Job:** vertical, job_spec, frozen_job_spec, confirmed, status draft|confirmed|running|complete  
- **Session:** job_id, vendor_id (tough|stonewaller|upseller), status, outcome_type, callback_window, conversation ids  
- **Quote:** line_items, total, red_flag, session_id  
- **TranscriptEvent:** speaker negotiator|vendor|system, text, ts_ms (relative on live bridge)  
- **ToolCall:** tool_name, payload, session  
- **IntakeDraft:** pending|filled for voice form fill  
- **negotiation_learnings:** vertical, tactic, outcome_delta, sample_count  

### Tools (webhook → `/api/tools/*`)
| Tool | Role |
|------|------|
| `log_quote` | Persist itemized quote; honesty/sum validation |
| `get_competing_bids` | Real quotes only for job (exclude self) |
| `close_session` | Terminal outcome; triggers learning extract |
| `lookup_benchmark` | Fair band from vertical config |
| `submit_spec` | Intake agent fills draft |

### Competing bid leverage
- Simulate: upseller produces total; tough waits, records get_competing_bids, drops price  
- Live: negotiator must call tool then cite; force-close must NOT invent random $ as firm itemized without firm language  

---

# PART 8 — Verticals (config-is-the-product)

Files: `config/verticals/{hvac,movers,medical-imaging,auto-repair}.json`  
Schema: `config/schema.ts`

Each vertical has:
- intake questions / job_spec fields  
- 3 vendors (tough / stonewaller / upseller) with **public** blurb + **secret** pricing_strategy (never to negotiator UI)  
- nature one-liners (4-word style for chat headers)  
- benchmarks + red_flag threshold  
- demo_defaults (for golden/demo only — **must not force live discovery location**)  

**HVAC vendors (names):** Summit Air, ComfortPro, ValueHVAC  
**Personas:** careful quality / cautious no phone quote / bargain front fees  

Bridge kickoff injects vertical-specific instruction (HVAC vs movers vs MRI vs auto).

---

# PART 9 — File map (complete inventory)

### App routes
- `src/app/page.tsx` — home → AppHome → LandingPage  
- `src/app/livee/page.tsx` — ProductWorkspace  
- `src/app/live/page.tsx` — golden sample  
- `src/app/demo/page.tsx` — demo redirect path  
- `src/app/layout.tsx` — fonts, metadata  
- `src/app/globals.css` — design system  

### Components (critical)
- `LandingPage.tsx`, `SiteHeader.tsx`, `ProductWorkspace.tsx`  
- `DiscoveryPanel.tsx`, `Top3Map.tsx`, `LearningPanel.tsx`  
- `NegotiatorDashboard.tsx` — older 3-column UI for `/live` sample  
- `CallsColumn`, `DealColumn`, `JobColumn`, `TranscriptTicker` — sample path  
- `GrokOpinion.tsx` — no-op  

### Lib
- `elevenlabs/bridge.ts` — final-turn, relative ts, await forceClose, honest close  
- `sessions/simulateNegotiation.ts` — parallel scripted Neon writes  
- `places/geocode.ts`, `overpass.ts`, `details.ts`  
- `review/dealReview.ts` — always one top_pick  
- `learning/bandit.ts`, `extract.ts`  
- `orchestrator/machine.ts`, `runtime.ts`  
- `ui/exportDealPdf.ts`, `mockStream.ts`  
- `tools/*` — business logic for webhooks  

### Agents / config / data / scripts
- prompts under `agents/prompts/`  
- `config/verticals/*`  
- `data/discovery/*` offline snapshots (fallback only)  
- `data/golden/*` replay  
- `scripts/eval.ts` 18 checks  
- `scripts/provision-agents.ts`  
- `scripts/dspy_train/*`  

### Gitignore notes
- `demo-video/`, most `*.mp4` ignored  
- `!public/media/` allowed for clouds-loop.mp4  

---

# PART 10 — API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/status` | live_mode, db, places, agent ids |
| GET | `/api/vertical?id=` | public vertical config |
| POST | `/api/jobs` | create job |
| PATCH | `/api/jobs/:id/confirm` | freeze spec; XState |
| POST | `/api/jobs/:id/extract-pdf` | text/file → job_spec |
| GET | `/api/jobs/:id/state` | poll sessions/quotes/transcripts/deal_review |
| POST | `/api/discovery` | live local providers |
| POST | `/api/sessions/start` | bridges or simulate |
| POST | `/api/intake/start` | draft + talk URL |
| GET | `/api/intake/status` | poll filled draft |
| GET | `/api/learning` | UCB1 playbook |
| GET | `/api/events` | SSE + poll fallback note |
| POST | `/api/tools/*` | agent tool webhooks |

---

# PART 11 — Discovery deep dive (Codex: do not re-break)

### Input
```json
{ "vertical": "hvac", "query_text": "AC not cooling in Chicago IL 60614", "location": "...", "zip": "optional" }
```

### Pipeline
1. Extract ZIP/city from free text  
2. Nominatim geocode → lat/lng + display_name  
3. Google Places searchText if `GOOGLE_PLACES_API_KEY`  
4. Else Overpass around lat/lng (radius 25km then 45km; multiple endpoints)  
5. Offline snapshot **only if geo failed**  
6. **Never** return Charlotte snapshot when geo is Chicago  

### UI consumption
- DiscoveryPanel ranks  
- Top3Map centers OSM iframe on geo  
- job_spec.zip updated when resolved  

### Known issue
Overpass can timeout/empty on Vercel; Places key is the production-quality fix. Labish may provide API key.

---

# PART 12 — Session start modes

### Prefer live when configured
`isLiveModeEnabled()` = API key + all 5 agent IDs.

### Body flags
- default: live if available else simulate  
- `simulate: true` forces scripted Neon path  
- `live: true` requests bridges  

### Background work
`waitUntil(runBridgesParallel | simulateJobNegotiations)`  

### Resumable simulate
Stuck jobs re-kicked by client poll re-POST after ~14s; server idempotent per-session.

---

# PART 13 — Bridge behavior (live ElevenLabs)

File: `src/lib/elevenlabs/bridge.ts`

- Text-mediated: agent_response from A → user_message to B  
- **Ignore partials** (`agent_chat_response_part`, incomplete “Hello, I am an…”)  
- Debounce final turns  
- Relative `ts_ms` from session start  
- Max turns ~18; watchdog; wall clock ~4m  
- `closePromise` awaited so serverless doesn’t drop closes  
- Force close: only auto-log itemized if firm language + clear grand total; else callback/decline  
- Kickoff injects vertical + playbook + job JSON; never show kickoff as chat bubble  
- Dynamic vars: job_id, session_id, company_key, job_spec_json, playbook, vertical  

**Dashboard human gate:** paste prompts from repo; point tools to prod URLs with secret header.

---

# PART 14 — Deal review rules

File: `src/lib/review/dealReview.ts`

- Always pick **exactly one** top_pick  
- Priority: clean ranked winner → lowest non-red total → lowest total → best callback → any session  
- Never headline “No single recommended deal yet” as product outcome  
- Transcript price parse fallback if tools missed  
- Red-flag: ≥ threshold below benchmark mid from vertical config  
- Concise why_top bullets  

Export: `openDealPdf` — print HTML → Save as PDF; chart confidence bar; layman language  

---

# PART 15 — Learning / RL

### Online (in product)
- Tactics: cite_competing_bid, request_itemization, cite_benchmark, etc.  
- On close: extractLearningsFromSession  
- UCB1 selectTacticsUcb → playbook string into live agents  
- Warm priors so untried arms don’t dominate first demo  

### Offline (not fully built)
- DSPy stub README + train_stub.py — optimize prompts from Neon traces later  

---

# PART 16 — Bugs fixed (major) — do not reintroduce

1. Replay startMock cancelled by effect cleanup  
2. maxDuration 800 → 300 Hobby  
3. Intake drafts process memory → Neon  
4. Sequential agents → parallel  
5. Kickoff leaked as SYSTEM chat  
6. Force close inventing random $ as itemized  
7. forceClose not awaited  
8. Partial quotes skipped synthesis  
9. deal empty / export without content  
10. `/live` white-on-white prices  
11. Architecture page  
12. Hardcoded 28202 discovery on live  
13. Wrong-city snapshot when geo resolved  
14. Sample auto-start (sample should fill only; then sample removed from UI)  
15. Logo A mark / jumping header  

---

# PART 17 — Multi-agent audits performed

### 8-agent recursive wave (requested by Labish)
1–2 Fixers (UI + core)  
3–6 Four reviewers  
7 Integrator applied must-fixes  
8 Final auditor SHIP  

### 4-agent earlier bug hunts
API/DB, UI, bridges, requirements map  

### RL sub-agent
Verified UCB1 formula, competing bids honesty, telephony removed  

---

# PART 18 — Commands cheat sheet

```bash
cd /Users/labishbardiya/Desktop/the-negotiator
npm install
npm run dev
npm run eval          # expect 18/18
npm run smoke
npm run provision     # ElevenLabs
npx vercel --prod
```

Smoke simulate: `npx tsx scripts/smoke-simulate.ts` (needs DATABASE_URL)

---

# PART 19 — Judge FAQ (prepared answers)

### Why only 3 agents not 5 or 10?
- Three **behavioral archetypes** cover market variance (premium, no-phone-quote, bait pricing).  
- Parallel voice is expensive/slow; UI readability collapses with 5–10 live chats.  
- Ranking needs diverse outcomes, not more clones.  
- Config can increase N later; 3 is the demo-optimal product choice.  
- Fallback simulate guarantees completion on stage.

### Are you calling real contractors?
- Demo uses **real ElevenLabs multi-agent conversations** and **real local business discovery** (Places/OSM).  
- Not real PSTN to shops (TCPA/cost); counters simulate provider types.  
- Production path would dial ranked Places phones via Twilio+EL (scaffolded then dropped for hackathon).

### Is data hardcoded?
- **Must not be for location.** Live path geocodes user query.  
- Golden `/live` replay uses fixed fixtures by design.  
- Vertical benchmarks in JSON are intentional config, not fake call content.

### What is the free vs paid Google need?
- **Places API (New)** only for GMB ratings/phone/address at scale.  
- Maps JS not required.  
- Without key: Nominatim + Overpass still live.

---

# PART 20 — Open work for Codex (priority)

1. Add `GOOGLE_PLACES_API_KEY` to Vercel; enable Places API (New); restrict key  
2. Re-provision ElevenLabs agents with latest `agents/prompts/*`  
3. Point all tool webhooks to `https://leverageai-tawny.vercel.app/api/tools/*` + secret  
4. Verify voice → submit_spec → composer fill on prod end-to-end  
5. Drop real demo video into landing blank  
6. Update README to match new routes/UI (still partially old)  
7. Harden Overpass timeouts / caching if Places key delayed  
8. Keep eval 18/18 green after any change  

---

# PART 21 — SuperGrok artifacts locations

| What | Path |
|------|------|
| This mega handoff | `~/Desktop/handle-codex.md` |
| Repo short handoff | `the-negotiator/HANDOFF_CODEX.md` |
| First prompt | `the-negotiator/docs/handoff/CODEX_FIRST_PROMPT.md` |
| Global memory copy | `the-negotiator/docs/handoff/super-grok-global-memory.md` |
| Project memory | `the-negotiator/docs/handoff/super-grok-project-memory.md` |
| Live SuperGrok memory | `~/.grok/memory/MEMORY.md` |
| Sessions | `~/.grok/sessions/` |
| Codex config | `~/.codex/config.toml` (model gpt-5.6-sol etc.) |
| Local secrets | `the-negotiator/.env.local` |
| Design reference | `the-negotiator/DESIGN.md` |

---

# PART 22 — Design system notes (current CSS)

- Variables: peach/sky gradients, glass blur ~40px, black frame `#050505`  
- Classes: `.glass-liquid`, `.btn-liquid-glass`, `.site-header`, `.logo-leverage`, `.wa-shell`, `.status-progress-fill`  
- Cloud video: `.cloud-video` object-fit cover  
- Responsive: mobile padding 6px frames, smaller threads, clamped headlines  

Inspiration references Labish sent:
- tryclean.ai layout (frame, CTA) but **cloud** not mountain  
- LEVERAGE peach logo art (wordmark only now)  
- WhatsApp bubbles refined to soft glass cards  
- Claude-style mode dropdown  

---

# PART 23 — Intro video (historical)

- Built ~58s intro with ElevenLabs voice clone once  
- Saved under Desktop / demo-video  
- **Must not push to GitHub** (gitignore demo-video, mp4 except public/media)  
- Landing still has blank demo video slot  

---

# PART 24 — Simulate path economics (stage backup)

If ElevenLabs flaky:
- `simulateJobNegotiations` still creates tough/stonewaller/upseller tracks  
- Tough drops after competing bid barrier  
- ValueHVAC red-flag lowball  
- ComfortPro documented decline  
- Neon rows identical shape for UI  

Labish insisted judges see real Neon path, not client-only theater — simulate still hits Neon.

---

# PART 25 — Voice intake wiring details

1. UI mic → POST `/api/intake/start` → intake_id + talk_url  
2. Opens `https://elevenlabs.io/app/talk-to?agent_id=...`  
3. Agent tool `submit_spec` → fills `intake_drafts`  
4. UI polls `/api/intake/status`  
5. On filled: **setPrompt(job text)** — does **not** auto-start negotiations  
6. User reviews and presses Send  

If empty: agent missing webhook to prod or missing intake_id — human fix in ElevenLabs dashboard.

---

# PART 26 — What Labish forbade

- Demo-only fake that doesn’t work live  
- Verbose jargon UI  
- Architecture page clutter  
- Sample always visible  
- “No recommendation” as happy path  
- Hardcoded PIN/city for live discovery  
- Twilio for this hackathon  
- Pushing intro video to GitHub  
- Rebuilding from scratch in Codex  

---

# PART 27 — Suggested Codex first tasks (only if Labish asks)

1. Places key integration test on prod Chicago query  
2. Provision script dry-run prompts push  
3. E2E playwright: text job with ZIP → discovery source live → 3 sessions → deal PDF  
4. README rewrite for `/` `/livee` `/live`  

---

# PART 28 — One-page mental model

```
Labish → Landing → Close Smart Deals → Portal
  User text/voice/file + vertical
  → job_spec + confirm
  → discover REAL shops at USER location
  → 3 parallel agent negotiations (or Neon simulate)
  → always 1 deal + PDF
  → learning updates tactics for next run
```

**Config JSON** swaps vertical. **ElevenLabs** is the mouth. **Neon** is the source of truth. **Vercel** is the stage.

---

# PART 29 — End of handoff

If anything conflicts between README and this file, **prefer this file + AGENTS.md**.  
README is partially outdated (older three-column job/calls/deal as only UI).

**Owner expectation:** Codex continues shipping polish and reliability; does not reset architecture.

---

*End of handle-codex.md — complete SuperGrok → Codex 5.6 context dump for LeverageAI / Hack-Nation 2026.*
