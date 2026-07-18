# ElevenLabs Agents Setup — LeverageAI

**Primary path:** `npm run provision`  
**Fallback:** manual dashboard steps below.

Obeys project law: **ElevenLabs Agents platform only** (no custom STT/TTS). Counter-agent prompts are **never** loaded by the negotiator runtime.

---

## Primary: provision script

```bash
# 1) Tunnel localhost so ElevenLabs can hit webhooks
ngrok http 3000

# 2) Provision (creates or PATCHes leverageai-* agents)
export ELEVENLABS_API_KEY=...
export APP_BASE_URL=https://xxxx.ngrok-free.app   # or production URL
npm run provision

# 3) Paste printed agent IDs into .env.local
```

The script:

1. Reads `agents/prompts/*` (5 isolated files)
2. Attaches webhook tools from `agents/tool-schemas.json` → `${APP_BASE_URL}/api/tools/*`
3. Sets dynamic variable placeholders (`job_id`, `session_id`, …)
4. Is **idempotent** on name prefix `leverageai-`

---

## Env vars

```bash
ELEVENLABS_API_KEY=
ELEVENLABS_INTAKE_AGENT_ID=
ELEVENLABS_NEGOTIATOR_AGENT_ID=
ELEVENLABS_TOUGH_AGENT_ID=
ELEVENLABS_STONEWALLER_AGENT_ID=
ELEVENLABS_UPSELLER_AGENT_ID=
APP_BASE_URL=https://your-host
DATABASE_URL=          # optional
GOOGLE_PLACES_API_KEY= # optional
XAI_API_KEY=           # optional document vision
```

**Live mode** (bridged agent↔agent sessions) activates only when **all five agent IDs + API key** are set. Otherwise `POST /api/sessions/start` stays scaffold/replay-safe.

---

## Tool attachment (who gets what)

| Agent | Tools |
|-------|--------|
| Intake | `submit_spec`, `close_session` |
| Negotiator | `get_competing_bids`, `lookup_benchmark`, `log_quote`, `close_session` |
| Tough / Stonewaller / Upseller | `log_quote`, `close_session` |

Webhook base: `${APP_BASE_URL}/api/tools/<name>`

---

## Manual dashboard fallback

If the API shape changes, create 5 agents in the ElevenLabs UI:

1. **leverageai-intake** — paste `agents/prompts/intake.md`
2. **leverageai-negotiator** — paste `agents/prompts/negotiator.md` + tools
3. **leverageai-tough** — paste `agents/prompts/counter-agents/tough.md` only
4. **leverageai-stonewaller** — paste stonewaller.md only
5. **leverageai-upseller** — paste upseller.md only

**Never** paste counter-agent prompts into the negotiator (isolation law).

---

## Agent-to-agent bridge

ElevenLabs has no native server-side agent↔agent mode. LeverageAI opens two WebSockets per session (`src/lib/elevenlabs/bridge.ts`) and relays audio + interruption frames. Sessions run **sequentially** for clean tool logs. Watchdog force-closes after 90s silence as `documented_decline(timeout)`.

---

## Verify

```bash
npm run eval    # 12/12
npm run smoke
npm run dev
# Stage insurance (zero env):
open http://localhost:3000/?replay=true
# Live-run offline replay:
open http://localhost:3000/?replay=live
```
