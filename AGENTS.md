# AGENTS.md — The Negotiator (Hack-Nation, 12h build)

> **Standing law for every human and every subagent.**  
> Read this before any edit, scaffold, or refactor.  
> Constraints here never get lost during task decomposition.  
> If a task conflicts with this file, **this file wins**.

---

## Project

**Product:** The Negotiator — voice agent that gathers phone quotes, negotiates, and ranks deals.  
**Challenge:** Hack-Nation 6th Global AI Hackathon · Challenge 01 · ElevenLabs.  
**Vertical (default):** HVAC / home AC (`/config/verticals/hvac.json`).  
**Config-swap proof:** `/config/verticals/movers.json` via `?vertical=movers`.  
**UI:** one screen (JOB | CALLS | DEAL), zero navigation, zero learning curve for judges.  
**Prompt files:** `/agents/prompts/` (isolated per agent — never merge negotiator + counter-agents).

---

## Non-negotiable constraints (every subagent must obey)

### Voice
- Voice: **ElevenLabs Agents platform ONLY**.
- Never build custom STT/TTS pipelines.
- Use native turn-taking / barge-in.
- Do not substitute other voice providers.

### Config-driven verticals
- All vertical-specific values live in `/config/verticals/*.json`:
  - job-spec taxonomy
  - price benchmarks
  - red-flag rules
  - negotiation levers
  - agent persona details (where not in isolated prompt files)
- **NEVER** hardcode a vertical value in application code.
- Swapping `movers.json` for `hvac.json` must change product behavior with **zero code edits**.

### Prompt isolation
- The negotiator agent and the **3 counter-agents** must have **FULLY ISOLATED** prompts.
- No shared script, no shared prompt file, no leaked pricing floors.
- Counter-agent pricing strategies are **secret** to the negotiator.
- Store prompts separately, e.g.:
  - `/prompts/negotiator.md` (or system prompt source used only for negotiator)
  - `/prompts/counter-agents/tough.md`
  - `/prompts/counter-agents/stonewaller.md`
  - `/prompts/counter-agents/upseller.md`

### Honesty & tools
- The negotiator’s system prompt must contain an **explicit honesty constraint**:
  - It may only cite quotes that exist in the DB (fetched via `get_competing_bids`).
  - It must **never** invent inventory, bids, or fees.
- `log_quote` server-side validation **rejects** malformed / unsourced entries.
- Leverage spoken on a call must be backed by a real DB row from a prior or concurrent logged quote.

### Call outcomes
- Every call **MUST** terminate in exactly one structured outcome:
  - `itemized_quote` | `callback_commitment` | `documented_decline`
- No free-text-only endings.

### Stack
- **Next.js** App Router + **TypeScript** + **Tailwind**
- **Postgres** (Neon) via **parameterized queries only**
- **ElevenLabs Agents API** + **WebSocket** for live transcript events
- **No** auth, **no** payments, **no** mobile app

### Simplicity
- **One screen**, zero navigation.
- If a feature needs explanation, **cut it**.
- Prefer fixed demo job + clear status cards over multi-page flows.

### Secrets
- Secrets via env vars only:
  - `ELEVENLABS_API_KEY`
  - `DATABASE_URL`
- Never commit keys, `.env` with secrets, or API credentials.

---

## Definition of done (acceptance tests)

A submission is done only when **all** of the following pass:

1. **Intake** (voice **OR** uploaded PDF quote) produces a valid `job_spec` JSON matching `/config` schema; user **confirms** before calls.
2. **3 simultaneous** negotiation sessions vs **3 counter-agents**; live transcripts stream to UI.
3. At least **one** session shows **price moving down mid-call** after the negotiator cites a **real** competing bid from the DB.
4. **Stonewaller** session ends as `documented_decline` with callback logged. **Upseller**’s hidden fees appear **itemized**.
5. **Report** ranks quotes, flags any quote **≥30% below benchmark** as a red flag (**warning, not winner**), links each claim to **transcript timestamps**.
6. Swapping `movers.json` for `hvac.json` changes the entire product behavior with **zero code edits**.

---

## Architecture rules (when implementing)

### One screen layout (conceptual zones — not routes)
1. **Job** — intake (voice / PDF) + confirm job card  
2. **Calls** — 3 company cards, live status + transcript stream  
3. **Deal** — ranked report, red flags, recommended deal + evidence  

Do **not** implement multi-route navigation for these zones.

### Required agent tools (negotiator)
- `log_quote` — write itemized quote; server validates schema + job_spec linkage  
- `get_competing_bids` — read only real DB quotes for this job (honesty backbone)  
- Structured terminal outcome writer for: `itemized_quote` | `callback_commitment` | `documented_decline`

### Counter-agents (demo market)
Exactly three, isolated:
1. **Tough** — highball / hard on price  
2. **Stonewaller** — “we don’t quote over the phone” → ends `documented_decline` (+ callback logged)  
3. **Upseller** — lowball + hidden fees that must surface itemized  

### Data
- Persist: job specs, sessions/calls, itemized quotes, outcomes, transcript segments with timestamps  
- Parameterized SQL only (no string-concat queries)

### Out of scope (hard ban)
- Real Twilio / SIP / PSTN outbound  
- Auth, payments, accounts, mobile  
- Custom STT/TTS stacks  
- Multi-vertical UI (config swap only)  
- Invented bids or fake leverage  
- Features that need a tutorial to understand  

---

## Subagent operating rules

1. **Read this file first.** Then touch code.  
2. **Do not expand scope** beyond acceptance tests and the constraints above.  
3. Prefer the **shortest path** to a demo that proves tests 1–6.  
4. If blocked, document the blocker; do not invent a parallel voice stack or second product surface.  
5. Keep vertical knowledge in `/config/verticals/*.json` and isolated prompts — never in shared “god” prompts.  
6. Never print or commit secrets.

---

## Pitch-aligned wow (build these only if acceptance path is green)

- Live “competing bid used” indicator when leverage fires  
- On-card price update when quote drops mid-call  
- Red-flag badge on report rows (≥30% below benchmark)  
- Transcript timestamp links on ranked claims  

These are **visualizations of acceptance tests**, not extra product surface.

---

## Env checklist

```bash
ELEVENLABS_API_KEY=
DATABASE_URL=
```

Optional non-secret app config may live in `.env.example` without real values.

---

*End of standing law. All subsequent plans and PRs must remain compatible with this file.*
