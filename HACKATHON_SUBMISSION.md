# LeverageAI — Hackathon Submission

## 1. Problem Statement

Getting a fair quote for a high-cost service is slow, fragmented, and stacked against the buyer. Customers repeat the same job details to multiple providers, receive vague or non-comparable prices, miss hidden fees, and negotiate without reliable market leverage. Even after several calls, the cheapest number may be incomplete, risky, or impossible to verify.

LeverageAI turns that process into one confirmed request, three parallel negotiations, and one evidence-backed recommendation.

## 2. Solution Overview

LeverageAI is an evidence-first AI negotiation system powered by ElevenLabs voice agents. The user describes a job by text, voice, or an uploaded quote. LeverageAI extracts a structured job specification, flags missing details, and requires explicit confirmation before any negotiation begins.

The **Close Smart Deals** flow then:

1. Discovers and scores relevant providers using real market data.
2. Launches three parallel agent-to-agent negotiations against distinct counterpart styles: a tough seller, a stonewaller, and an upseller.
3. Streams live call status and transcripts into a single workspace.
4. Forces every call into a structured outcome: an itemized quote, callback commitment, or documented decline.
5. Validates quotes server-side and allows the negotiator to cite only competing bids that already exist in the database.
6. Ranks complete quotes, flags suspicious pricing and missing terms, and links claims back to timestamped evidence.
7. Produces a human-review handoff and evidence bundle instead of automatically booking, paying, or purchasing.

The result is not just a lower number. It is a defensible deal the user can inspect before acting.

## 3. Key Features

- **Multimodal intake:** Text, voice, PDF, and TXT inputs resolve into the same config-defined job specification.
- **Human confirmation gate:** Ambiguous or missing requirements are surfaced before calls start; the confirmed job becomes immutable.
- **Parallel voice negotiations:** Three isolated ElevenLabs counter-agents test meaningfully different seller behaviors without sharing prompts or pricing strategies.
- **Evidence-only leverage:** The negotiator can reference only persisted bids returned by `get_competing_bids`; invented quotes are blocked by design.
- **Server-validated itemization:** `log_quote` verifies job, session, vendor, line items, totals, required categories, and red-flag rules before a quote can rank.
- **Live negotiation workspace:** Job, calls, transcripts, price movement, and the final deal appear in one judge-friendly interface.
- **Market-aware ranking:** Provider reputation, review volume, freshness, operational signals, quote quality, and negotiation outcomes feed the recommendation.
- **Risk detection:** Extremely low bids, hidden fees, incomplete scopes, and missing booking terms are warnings—not automatic winners.
- **Auditable evidence bundle:** Users can export the report, persisted quotes, timestamped transcripts, recordings when available, tool events, learning comparison, and booking draft.
- **Constrained learning loop:** A UCB1 bandit learns which negotiation tactics produce price movement while fixed honesty and safety rules remain outside the learner.
- **Config-driven verticals:** HVAC, movers, auto repair, and medical imaging use shared code with vertical-specific schemas, benchmarks, red flags, and negotiation levers stored in configuration.
- **Human-in-the-loop close:** LeverageAI prepares the next step but never authorizes work, sends payment, or books automatically.

## 4. Tech Stack Used

- **Languages:** TypeScript, JavaScript, SQL, CSS, and a small Python training stub.
- **Frontend:** Next.js 16 App Router, React 19, Tailwind CSS 4, and XState for explicit workflow state.
- **Backend:** Next.js route handlers and Vercel Functions for intake, discovery, sessions, agent tools, events, evidence, and webhooks.
- **Voice AI:** ElevenLabs Agents API with five isolated agents, native turn-taking, live WebSocket transcript events, workspace tools, and signed post-call webhooks.
- **Data:** Neon Postgres through parameterized `pg` queries, with a memory-store fallback for deterministic demos and tests.
- **Validation and reliability:** Zod schemas, idempotent agent provisioning, webhook HMAC verification, retry deduplication, bounded external requests, and deterministic reliability/evaluation scripts.
- **Discovery:** Google Places when configured, with OpenStreetMap, Nominatim, and Overpass fallbacks plus caching by vertical and ZIP code.
- **Evidence and exports:** Vercel Blob, `pdf-lib`, `JSZip`, and structured JSON/Markdown artifacts.
- **Deployment:** Deployed on Vercel with serverless APIs, managed environment variables, Vercel Functions, and durable recording support through Vercel Blob.

Architecturally, the product separates the UI, orchestration state machine, agent runtime, tool layer, evidence pipeline, ranking logic, learning loop, and storage adapters. That separation keeps live execution auditable while preserving a deterministic replay path for stage demos.

## 5. What Makes It Novel or Hard to Build

Most AI negotiation demos optimize for a convincing conversation. LeverageAI optimizes for a trustworthy decision.

The hard part is coordinating multiple real-time voice agents while maintaining strict evidence integrity. Transcripts can contain ranges, teaser prices, omissions, or claims that sound final but are not. LeverageAI refuses to treat spoken text as a valid quote until the server validates and persists a complete structure. It also prevents the negotiator from fabricating leverage by restricting competing-bid claims to database-backed evidence.

The system combines:

- parallel agent orchestration and live transcript streaming;
- isolated adversarial seller personas;
- immutable job context and structured terminal outcomes;
- server-side quote validation and red-flag enforcement;
- real-market provider discovery with graceful network degradation;
- evidence-linked deal ranking;
- signed post-call ingestion and portable audit exports; and
- adaptive tactic selection without adaptive safety rules.

That creates a difficult but important balance: autonomous enough to negotiate, constrained enough to trust, and transparent enough for a human to make the final call.

## 6. Live Demo and Video

- **Live demo:** https://leverageai-tawny.vercel.app
- **Demo video:** [Add final hackathon demo video link]
- **Primary CTA:** **Close Smart Deals**

