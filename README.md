# LeverageAI

LeverageAI is an evidence-first voice negotiator for Hack-Nation Challenge 01 (ElevenLabs). It turns one confirmed request into three parallel, distinct agent-to-agent negotiations and returns a ranked, auditable recommendation. It never purchases or books automatically.

The challenge contract and repository law are in [AGENTS.md](./AGENTS.md). Architecture rationale is in [docs/ARCHITECTURE_DECISIONS.md](./docs/ARCHITECTURE_DECISIONS.md).

## Product routes

| Route | Purpose |
|---|---|
| `/` | Existing marketing homepage; intentionally unchanged |
| `/livee` | Live product: text/PDF/voice intake, confirmation, discovery, three negotiations, evidence |
| `/live` | Deterministic golden demo/replay for stage reliability |

The live and demo experiences are honest about the counterparties: local discovery uses real market data, while the challenge demo negotiates against three isolated ElevenLabs counter-agents. No real business is represented as having been called.

## End-to-end flow

1. Text, a text-bearing PDF/TXT, or the ElevenLabs intake agent produces the same config-defined `job_spec`.
2. Missing or invalid required terms are shown to the user. Nothing starts until the user explicitly confirms.
3. Google Places (if configured) or free OSM/Nominatim builds and scores the real-world call-list candidates. Requests are bounded by timeouts and cached by vertical + ZIP.
4. Exactly three deep sessions run in parallel: tough, stonewaller, and upseller. These cover the challenge’s required negotiation styles without multiplying voice cost.
5. Only persisted, itemized quotes may be ranked. Competing-bid leverage can cite only DB rows returned by `get_competing_bids`.
6. Each call ends as `itemized_quote`, `callback_commitment`, or `documented_decline`.
7. The result includes timestamped evidence, questions generated from missing booking terms, a human-review handoff draft, learning comparison, recordings when available, and a ZIP evidence bundle.

## Why three agents, not more?

Discovery can score many providers cheaply without an LLM. Voice negotiation is the expensive stage, so it uses three deliberately diverse agents rather than several near-duplicates. Three is also the challenge minimum and the repository’s acceptance contract. With roughly 100,000 ElevenLabs credits, the efficient funnel is:

`many discovered providers -> deterministic ranking -> three voice negotiations -> one evidence-backed recommendation`

Adding agents before each of the three styles is reliable would increase cost, latency, and failure surface more than information gain. A future adaptive fourth call should be triggered only when all three outcomes are incomplete or too close; it is intentionally not enabled during the hackathon because `AGENTS.md` requires exactly three counter-agents.

## Learning loop

The negotiator does not rewrite its own honesty rules. After each closed session, deterministic tactic detection records both successes and zero-improvement uses. A constrained UCB1 bandit then balances exploration of under-tested tactics with exploitation of tactics that have produced observed price improvement in that vertical. The UI reports sample count, average improvement, confidence, and whether a tactic was selected for the current run.

This can improve tactic selection as evidence accumulates, but it does not claim that every individual call must improve. Safety, quote completeness, job immutability, and the no-invented-bids rule are fixed constraints outside the learner.

## Quick start

```bash
npm install
npm run dev
```

Open:

- Live workspace: `http://localhost:3000/livee`
- Golden stage demo: `http://localhost:3000/live`
- Config proof: `http://localhost:3000/live?vertical=movers`

Quality gates:

```bash
npm test
npm run eval
npm run smoke
npm run lint
npm run build
```

## Fresh ElevenLabs account

Use a deployed or tunneled public HTTPS URL. The provisioner uses the current workspace-tool API, attaches exact tool IDs, creates five isolated agents, creates an HMAC post-call webhook, enables transcript/audio delivery with retries, and verifies the remote graph.

```bash
# Put the new key and deployed URL in .env.local first.
npm run provision -- --write-env
npm run provision:verify
```

`--write-env` writes only generated agent IDs and generated webhook secrets. It never prints API keys or HMAC secrets. See [agents/SETUP.md](./agents/SETUP.md).

## Environment

| Variable | Purpose |
|---|---|
| `ELEVENLABS_API_KEY` | New ElevenLabs account API key |
| Five `ELEVENLABS_*_AGENT_ID` values | Intake, negotiator, and three isolated counterparties |
| `DATABASE_URL` | Shared Neon data; required for live/serverless sessions |
| `APP_BASE_URL` | Public HTTPS app origin used by ElevenLabs tools/webhooks |
| `TOOLS_WEBHOOK_SECRET` | Authenticates agent tool calls |
| `ELEVENLABS_WEBHOOK_SECRET` | Verifies post-call HMAC signatures |
| `BLOB_READ_WRITE_TOKEN` | Durable recording URLs on Vercel |
| `GOOGLE_PLACES_API_KEY` | Optional denser discovery; OSM is the free fallback |

All secrets remain in `.env.local`/deployment settings and are gitignored.

## Evidence bundle

`GET /api/jobs/:id/evidence` returns a ZIP containing:

- `report.pdf`
- `transcripts.json` and `transcripts.md`
- `quotes.json`
- `recordings.json`
- `tool-events.json`
- `learning-comparison.json`
- `booking-request.txt`
- `manifest.json`

The report never turns transcript text into a quote silently. If a complete persisted quote or recording does not exist, the absence is stated explicitly.

## Config-driven verticals

All vertical-specific intake fields, benchmarks, quote categories, booking terms, discovery filters, negotiation levers, and provider personas live in `config/verticals/*.json`. Current configs are HVAC, movers, cash medical imaging, and auto repair. Shared code contains no vertical-specific prices or fee labels.

## Scope boundaries

- ElevenLabs Agents only for voice; no custom STT/TTS.
- No auth/login for the hackathon. Recent history is anonymous, browser-local, and limited to five runs.
- No payment, automatic booking, or purchase authorization.
- No PSTN/Twilio in this MVP. The challenge explicitly permits counter-agents, and real-business discovery demonstrates where a production call list comes from.
