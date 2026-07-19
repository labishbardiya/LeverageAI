# Fresh ElevenLabs setup

LeverageAI uses ElevenLabs Agents only. It provisions reusable workspace tools, five isolated agents, and a signed post-call webhook from source-controlled prompts and schemas.

## Prerequisites

- A new ElevenLabs API key with permission to create agents, tools, and workspace webhooks.
- A public HTTPS deployment or tunnel. `localhost` cannot receive ElevenLabs webhooks.
- A migrated Neon database in `DATABASE_URL`.

Set these in `.env.local` without committing them:

```bash
ELEVENLABS_API_KEY=...
APP_BASE_URL=https://your-public-host
DATABASE_URL=...
BLOB_READ_WRITE_TOKEN=... # recommended for durable audio
```

## One-command provisioning

```bash
npm run provision -- --write-env
npm run provision:verify
```

The first command:

1. validates the selected conversational model against `/v1/convai/llm/list` (default `gemini-2.5-flash`, override with `ELEVENLABS_LLM_ID`);
2. creates or updates the five workspace webhook tools from `agents/tool-schemas.json`;
3. generates `TOOLS_WEBHOOK_SECRET` when absent and attaches it as `x-tools-secret`;
4. creates or updates `leverageai-intake`, `leverageai-negotiator`, `leverageai-tough`, `leverageai-stonewaller`, and `leverageai-upseller`;
5. attaches tools through `conversation_config.agent.prompt.tool_ids`;
6. creates an HMAC workspace webhook at `/api/webhooks/elevenlabs`, enables transcript/audio delivery and retry support;
7. verifies exact remote prompts, exact tool IDs, and workspace webhook settings;
8. writes agent IDs and generated secrets to `.env.local` without printing them.

The command is idempotent by `leverageai-` names. If a matching post-call webhook already exists but its original HMAC secret is lost, delete that webhook in ElevenLabs and rerun so a new secret can be captured.

## Tool isolation

| Agent | Attached tools |
|---|---|
| Intake | `submit_spec` |
| Negotiator | `log_quote`, `get_competing_bids`, `lookup_benchmark`, `close_session` |
| Tough | none |
| Stonewaller | none |
| Upseller | none |

Counter-agents never receive DB tools and never share prompt text with the negotiator. Their secret strategies are injected only into their own conversation socket.

## Post-call evidence

ElevenLabs sends `post_call_transcription` and `post_call_audio` to `/api/webhooks/elevenlabs`. The app:

- validates `ElevenLabs-Signature` with timestamp tolerance and constant-time HMAC comparison;
- resolves the exact session by conversation ID (or its scoped dynamic session ID);
- deduplicates webhook retries;
- stores the negotiator-side recording as the canonical evidence track;
- never accepts an unsigned webhook.

Set `BLOB_READ_WRITE_TOKEN` in deployment for durable audio. Local development falls back to `public/recordings`; Vercel without Blob records an explicit transcript-only note.

## Verification and failure modes

```bash
npm run provision:verify
npm test
npm run eval
npm run smoke
npm run build
```

- `Prompt mismatch`: remote agent was edited manually; rerun provisioning.
- `Tool mismatch`: remove stale manual attachments by rerunning provisioning.
- `APP_BASE_URL must use HTTPS`: deploy or start a tunnel first.
- `post-call webhook secret is missing`: restore the original secret or recreate the webhook.
- Live mode remains off unless all five IDs, the API key, and `DATABASE_URL` are configured.
