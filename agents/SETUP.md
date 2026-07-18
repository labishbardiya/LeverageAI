# ElevenLabs Agents Setup — The Negotiator

Human runbook to create **5 isolated agents**, wire tools, and connect env vars.  
Obeys project law: **ElevenLabs Agents platform only** (no custom STT/TTS). Counter-agent prompts are **never** loaded by the negotiator runtime.

---

## Prerequisites

- ElevenLabs account with **Agents / Conversational AI** access
- API key with agents permissions
- App running locally (`npm run dev`) **or** deployed URL
- For local webhooks from ElevenLabs cloud → public tunnel (ngrok, Cloudflare Tunnel, etc.)

```bash
# example tunnel
ngrok http 3000
# export https://xxxx.ngrok-free.app as YOUR_HOST
```

---

## Env vars (app)

Put in `.env.local` (never commit secrets):

```bash
ELEVENLABS_API_KEY=

# Agent IDs from dashboard after create (fill as you go)
ELEVENLABS_INTAKE_AGENT_ID=
ELEVENLABS_NEGOTIATOR_AGENT_ID=
ELEVENLABS_TOUGH_AGENT_ID=
ELEVENLABS_STONEWALLER_AGENT_ID=
ELEVENLABS_UPSELLER_AGENT_ID=

DATABASE_URL=

# Optional: shared secret if you protect /api/tools/*
TOOLS_WEBHOOK_SECRET=
```

Also keep `DATABASE_URL` for quote persistence (honesty backbone).

---

## Create 5 agents (dashboard)

In [ElevenLabs Agents](https://elevenlabs.io/app/agents):

| # | Dashboard name (suggested) | Prompt file | Tools |
| --- | --- | --- | --- |
| 1 | `negotiator-intake` | [`prompts/intake.md`](./prompts/intake.md) | `submit_spec` |
| 2 | `negotiator-buyer` | [`prompts/negotiator.md`](./prompts/negotiator.md) | `log_quote`, `get_competing_bids`, `lookup_benchmark`, `close_session` |
| 3 | `vendor-summit-tough` | [`prompts/counter-agents/tough.md`](./prompts/counter-agents/tough.md) | **none** |
| 4 | `vendor-comfortpro-stonewall` | [`prompts/counter-agents/stonewaller.md`](./prompts/counter-agents/stonewaller.md) | **none** |
| 5 | `vendor-valuehvac-upsell` | [`prompts/counter-agents/upseller.md`](./prompts/counter-agents/upseller.md) | **none** |

### For each agent

1. **Create agent** → Conversational / voice agent.
2. **System prompt**: paste the **entire** matching `.md` file contents (including headings is fine).
3. **First message** (optional but useful):
   - Intake: short greeting asking what’s wrong with the system.
   - Negotiator: “Hi, I’m calling on behalf of a homeowner for a replacement quote…”
   - Tough: “Summit Air Pros, Marcus.”
   - Stonewaller: “ComfortPro, this is Diane.”
   - Upseller: “ValueHVAC, Chris speaking!”
4. **Voice**: pick distinct voices so judges can tell companies apart.
5. **Turn-taking / barge-in**: leave **native** defaults on (do not build custom STT/TTS).
6. **Language**: English.
7. **LLM**: prefer a strong tool-using model for **intake** + **negotiator** (tools). Counter-agents can use a fast conversational model.
8. Copy each **Agent ID** into the env vars above.

### Isolation checklist (critical)

- [ ] Negotiator prompt does **not** include Summit floors, ComfortPro policy secrets, or ValueHVAC fee stack.
- [ ] Each counter-agent has **only** its own file pasted.
- [ ] You never paste `tough.md` + `negotiator.md` into one agent.
- [ ] Runtime code loads negotiator by `ELEVENLABS_NEGOTIATOR_AGENT_ID` only; counter sessions use their own IDs.

---

## Wire tools (webhook)

Source of truth for parameter shapes: [`tool-schemas.json`](./tool-schemas.json).

Replace `https://YOUR_HOST` with your tunnel or deploy origin.

### Intake → `submit_spec`

- **Type:** Client tool (preferred for browser widget) **or** Webhook `POST /api/tools/submit_spec`
- **When client:** register `submit_spec` in the frontend conversation client so the job card updates.
- **When webhook:** body = job_spec JSON (`confirmed: true` required).

### Negotiator webhooks

| Tool | Method | URL |
| --- | --- | --- |
| `log_quote` | POST | `https://YOUR_HOST/api/tools/log_quote` |
| `get_competing_bids` | POST | `https://YOUR_HOST/api/tools/get_competing_bids` |
| `lookup_benchmark` | POST | `https://YOUR_HOST/api/tools/lookup_benchmark` |
| `close_session` | POST | `https://YOUR_HOST/api/tools/close_session` |

For each tool in the dashboard:

1. Add Tool → **Webhook**
2. Name **exactly**: `log_quote` / `get_competing_bids` / `lookup_benchmark` / `close_session` / `submit_spec`
3. Method POST, content-type JSON
4. Body parameters per `tool-schemas.json` (mark required fields)
5. Optional header: `Authorization: Bearer <TOOLS_WEBHOOK_SECRET>`

**Counter-agents:** do not attach these tools.

---

## Dynamic variables / first context

When starting a **negotiator** conversation from the app, pass:

- `job_id`
- `session_id`
- `company_key` (`tough` | `stonewaller` | `upseller`)
- `company_name`
- Serialized **confirmed job_spec** (so the agent states the job identically)

Exact mechanism depends on ElevenLabs conversation initiation (signed URL / conversation token + dynamic variables). Helpers live in `src/lib/elevenlabs/`.

---

## Agent-to-agent bridge (demo intent)

Production PSTN is **out of scope**. Demo bridge:

```
[Homeowner UI]
    │ voice
    ▼
[Intake agent] --submit_spec--> job_spec confirmed
    │
    ▼
App starts 3 parallel sessions:
    ├─ Negotiator conversation A  ↔  (audio bridge)  ↔  Tough conversation
    ├─ Negotiator conversation B  ↔  (audio bridge)  ↔  Stonewaller conversation
    └─ Negotiator conversation C  ↔  (audio bridge)  ↔  Upseller conversation
```

### Intended runtime behavior

1. For each vendor, the app creates **two** ElevenLabs conversations (or one negotiator session configured with vendor context + a separate counter-agent session).
2. **Bridge:** pipe assistantr/user audio or text turns between sessions so the negotiator “calls” the counter-agent:
   - Minimal path (hackathon): **text relay** — take negotiator agent messages as user input to counter-agent and vice versa, while UI shows both transcripts.
   - Richer path: WebRTC/websocket media relay if time allows — still **ElevenLabs** for all voice.
3. Negotiator tools hit **your** `/api/tools/*` so quotes land in Postgres.
4. When one vendor’s quote is logged, later `get_competing_bids` on another call returns it → price can move (Tough ladder).
5. UI **Calls** zone streams transcripts via ElevenLabs conversation events / websocket.

### Partial bridge OK for wiring day

If full duplex audio bridge is incomplete:

- Still create all 5 agents and verify tools with dashboard “Test.”
- Still run negotiator against each counter-agent in the ElevenLabs playground manually.
- App can simulate bridge with sequential message relay for the judge demo.

**Never** implement a custom STT/TTS stack to replace ElevenLabs.

---

## Sanity tests (before demo)

1. **Intake:** speak a broken AC job → `submit_spec` → job card shows confirmed spec.
2. **Upseller:** push itemization three times → hear refrigerant / permit / haul-away / diagnostic fees.
3. **Stonewaller:** no dollar total; callback window or clear phone-quote decline.
4. **Tough:** hold ~$9400 until you (as caller) cite a **specific** competing amount; then stepwise drop toward $7600 floor — never below.
5. **Negotiator tools:** `log_quote` row in DB → `get_competing_bids` returns it → negotiator cites only that figure.
6. **close_session:** every call ends with exactly one of `itemized_quote` | `callback_commitment` | `documented_decline`.

---

## Prompt file map (do not merge)

```
agents/prompts/intake.md
agents/prompts/negotiator.md
agents/prompts/counter-agents/tough.md
agents/prompts/counter-agents/stonewaller.md
agents/prompts/counter-agents/upseller.md
```

Counter-agent secret floors/fees live **only** under `counter-agents/`.

---

## API helper reference

TypeScript wrappers: [`src/lib/elevenlabs/`](../src/lib/elevenlabs/)

- Read agent IDs from env
- `fetch` ElevenLabs REST with `ELEVENLABS_API_KEY`
- Start conversation / signed URL helpers for the UI
- No custom speech pipelines

---

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Tool never fires | Tool name matches prompt; strong LLM; webhook URL public |
| 401 on tools | `TOOLS_WEBHOOK_SECRET` / auth header |
| Negotiator invents bids | Honesty block present; `get_competing_bids` actually returns data |
| Tough never drops | Competing cite must include a **specific dollar** amount |
| Secrets leaked | Confirm negotiator agent prompt has zero counter-agent floors |

---

*End of setup runbook.*
