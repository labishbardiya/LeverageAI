# Architecture decisions

This file records the tradeoffs behind LeverageAI so implementation choices are reviewable rather than accidental.

## ADR-001: broad discovery, three deep negotiations

**Decision:** Discover and score many providers with deterministic/free data, then spend voice credits on exactly three distinct negotiation styles.

**Why:** Provider discovery is cheap; live voice minutes are the dominant credit and latency cost. Tough, stonewaller, and upseller maximize behavioral diversity and directly cover the challenge brief. More agents would mostly duplicate information until these three are reliable. Three is also the repository acceptance contract.

**Credit policy:** Search/ranking uses no LLM. Each live session has a five-minute cap, concise prompts, 500 response-token cap, no parallel tool calls inside one agent, and only the negotiator receives tools. A future adaptive fourth call is justified only when all three results are incomplete or statistically tied; it is disabled for the hackathon.

## ADR-002: simulated market, real discovery

**Decision:** The call list is sourced from Google Places or OSM, but the demo negotiates with isolated ElevenLabs counter-agents.

**Why:** The challenge explicitly permits counter-agents. The repository law excludes PSTN for cost, legal, and demo reliability. UI copy identifies discovered businesses as call-list evidence and does not claim they were contacted.

## ADR-003: deterministic intake before optional intelligence

**Decision:** Text/PDF extraction is config-driven and only emits evidenced values. Missing/ambiguous values become user questions; the user confirms the immutable spec.

**Why:** A plausible invented tonnage, body part, vehicle model, or access constraint corrupts every later quote. Deterministic extraction plus explicit review is safer and cheaper than silently trusting a generative parse. Text-bearing PDF and TXT are supported; scanned/image-only documents fail with an actionable OCR message.

## ADR-004: workspace tools, not legacy inline tools

**Decision:** Create tools with `/v1/convai/tools` and attach exact IDs through `conversation_config.agent.prompt.tool_ids`.

**Why:** ElevenLabs removed legacy inline prompt tools. A source-controlled, idempotent provisioner prevents dashboard drift and verifies prompts and tool graphs on every fresh account.

## ADR-005: server-side evidence is the source of truth

**Decision:** A quote exists only after `log_quote` validates session/job/vendor linkage, numeric line items, exact total, vertical-required categories, and red-flag rules.

**Why:** Transcript price mentions can be incomplete ranges or teaser prices. They remain transcript evidence and are never silently promoted into ranked quotes. Competing leverage comes only from persisted rows returned by `get_competing_bids`.

## ADR-006: fixed safety rules, adaptive tactic selection

**Decision:** Learn negotiation tactics with a constrained UCB1 contextual bucket per vertical. Do not let the agent rewrite prompts or honesty constraints.

**Why:** UCB1 is sample-efficient, auditable, deterministic, and appropriate for the small hackathon dataset. Each used tactic receives an observation—including zero improvement—to reduce survivorship bias. The tactic closest to an observed price drop receives causal credit. Safety and itemization gates are outside the learner.

**Claim boundary:** The system should improve expected tactic selection as observations accumulate; no system can truthfully guarantee every call improves.

## ADR-007: anonymous local history, no accounts

**Decision:** Keep the five most recent job IDs and display summaries in browser `localStorage`; durable evidence remains in Neon by unguessable UUID.

**Why:** Login/signup adds failure surface and violates `AGENTS.md`. Browser-local history demonstrates continuity without collecting identity. It is explicitly anonymous and device-local, not a security boundary for a post-hackathon product.

## ADR-008: human handoff, never automatic purchase

**Decision:** Generate missing-term questions and a copyable booking-request draft. Do not call a booking/payment API.

**Why:** Quotes often omit warranty, cancellation, availability, fees, or written-total terms. The draft requests written clarification and ends with explicit no-authorization language. Humans retain the final decision.

## ADR-009: evidence ZIP and signed post-call ingestion

**Decision:** Download one ZIP with PDF report, quotes, timestamped transcripts, recording links, tool events, learning comparison, booking draft, and manifest. Verify ElevenLabs post-call HMAC before ingestion and deduplicate retries.

**Why:** Judges and users need portable proof, not a dashboard claim. The raw JSON supports audit; the PDF supports human review. Missing audio or quote evidence is reported, not fabricated.

## ADR-010: network dependencies must degrade

**Decision:** Bound Nominatim, Overpass, Google Places, and details requests with timeouts; query Overpass mirrors in parallel; cache by vertical+ZIP.

**Why:** Free public services are valuable but can be slow. Discovery must never leave confirmation spinning indefinitely or issue duplicate network calls for the ranking and map panels.
