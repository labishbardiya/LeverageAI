/**
 * Conversation helpers — start / signed URL / bridge intent.
 * Voice remains on ElevenLabs Agents; this file only orchestrates sessions.
 */

import {
  COUNTER_AGENT_SLOTS,
  getAgentId,
  tryGetAgentId,
  type NegotiatorAgentSlot,
} from "./env";
import { elevenLabsFetch } from "./client";
import type {
  BridgePairIntent,
  ConversationDynamicVariables,
  ConversationRef,
  ConversationTokenResponse,
  CreateConversationOptions,
  SignedUrlResponse,
} from "./types";

/**
 * Get a signed WebSocket/conversation URL for the browser widget.
 * Endpoint path follows ElevenLabs Conversational AI convention; adjust if dashboard docs differ.
 */
export async function getConversationSignedUrl(
  agentId: string
): Promise<SignedUrlResponse> {
  const q = new URLSearchParams({ agent_id: agentId });
  return elevenLabsFetch<SignedUrlResponse>(
    `/convai/conversation/get_signed_url?${q.toString()}`,
    { method: "GET" }
  );
}

/**
 * Alternative: conversation token for client SDK connect.
 */
export async function getConversationToken(
  agentId: string
): Promise<ConversationTokenResponse> {
  const q = new URLSearchParams({ agent_id: agentId });
  return elevenLabsFetch<ConversationTokenResponse>(
    `/convai/conversation/token?${q.toString()}`,
    { method: "GET" }
  );
}

export function normalizeSignedUrl(res: SignedUrlResponse): string | null {
  return res.signed_url ?? res.signedUrl ?? null;
}

export function normalizeConversationId(
  res: SignedUrlResponse | ConversationTokenResponse
): string | null {
  return res.conversation_id ?? res.conversationId ?? null;
}

/**
 * Build dynamic variables for a negotiator call against one vendor.
 * job_spec_json must be the confirmed job only — never counter-agent secrets.
 */
export function buildNegotiatorDynamicVariables(input: {
  jobId: string;
  sessionId: string;
  companyKey: "tough" | "stonewaller" | "upseller";
  /** Display name from vertical config vendors — never hardcode per vertical. */
  companyName: string;
  jobSpecJson: string;
  vertical?: string;
}): ConversationDynamicVariables {
  return {
    job_id: input.jobId,
    session_id: input.sessionId,
    company_key: input.companyKey,
    company_name: input.companyName,
    job_spec_json: input.jobSpecJson,
    vertical: input.vertical,
  };
}

export function buildIntakeDynamicVariables(input: {
  vertical?: string;
}): ConversationDynamicVariables {
  return {
    vertical: input.vertical ?? "hvac",
  };
}

/**
 * Resolve agent id for a slot from env and return a conversation ref scaffold
 * after fetching a signed URL (browser attaches audio).
 */
export async function startAgentSession(
  slot: NegotiatorAgentSlot,
  options: {
    jobId?: string;
    sessionId?: string;
    companyKey?: "tough" | "stonewaller" | "upseller";
    /** From vertical config vendor display name */
    companyName?: string;
    jobSpecJson?: string;
    vertical?: string;
    userId?: string;
  } = {}
): Promise<{ ref: ConversationRef; signedUrl: string | null; raw: SignedUrlResponse }> {
  const agentId = getAgentId(slot);

  let dynamicVariables: ConversationDynamicVariables | undefined;
  if (
    slot === "negotiator" &&
    options.jobId &&
    options.sessionId &&
    options.companyKey &&
    options.jobSpecJson &&
    options.companyName
  ) {
    dynamicVariables = buildNegotiatorDynamicVariables({
      jobId: options.jobId,
      sessionId: options.sessionId,
      companyKey: options.companyKey,
      companyName: options.companyName,
      jobSpecJson: options.jobSpecJson,
      vertical: options.vertical,
    });
  } else if (slot === "intake") {
    dynamicVariables = buildIntakeDynamicVariables({
      vertical: options.vertical,
    });
  }

  // Signed URL endpoint is agent-scoped; dynamic variables are applied by the
  // client SDK when starting the session (passed through conversation config).
  void dynamicVariables;
  void options.userId;

  const raw = await getConversationSignedUrl(agentId);
  const conversationId = normalizeConversationId(raw) ?? `pending_${slot}_${Date.now()}`;

  return {
    ref: {
      conversationId,
      agentId,
      slot,
      companyKey: options.companyKey,
    },
    signedUrl: normalizeSignedUrl(raw),
    raw,
  };
}

/**
 * Intent objects for 3 parallel negotiator ↔ counter-agent pairs.
 * Runtime bridge (text or media relay) is implemented by the sessions layer;
 * this only documents pairing and never loads counter prompts into negotiator.
 */
export function buildTripleBridgeIntents(input: {
  jobId: string;
  /** Base session id; per-vendor suffix applied. */
  sessionIdBase: string;
  jobSpecJson: string;
}): BridgePairIntent[] {
  const negotiatorAgentId = getAgentId("negotiator");
  const intents: BridgePairIntent[] = [];

  for (const companyKey of COUNTER_AGENT_SLOTS) {
    const counterAgentId = tryGetAgentId(companyKey);
    if (!counterAgentId) {
      continue;
    }
    intents.push({
      negotiatorAgentId,
      counterAgentId,
      companyKey,
      jobId: input.jobId,
      sessionId: `${input.sessionIdBase}_${companyKey}`,
      jobSpecJson: input.jobSpecJson,
    });
  }

  return intents;
}

/**
 * Webhook stub: acknowledge ElevenLabs post-call / event webhooks.
 * Wire this from an App Router route; persistence lives elsewhere.
 */
export function parseElevenLabsWebhookBody(
  body: unknown
): {
  conversationId: string | null;
  agentId: string | null;
  type: string | null;
  data: Record<string, unknown>;
} {
  if (!body || typeof body !== "object") {
    return { conversationId: null, agentId: null, type: null, data: {} };
  }
  const b = body as Record<string, unknown>;
  const data =
    b.data && typeof b.data === "object"
      ? (b.data as Record<string, unknown>)
      : {};
  return {
    conversationId:
      (typeof b.conversation_id === "string" && b.conversation_id) ||
      (typeof data.conversation_id === "string" && data.conversation_id) ||
      null,
    agentId:
      (typeof b.agent_id === "string" && b.agent_id) ||
      (typeof data.agent_id === "string" && data.agent_id) ||
      null,
    type: typeof b.type === "string" ? b.type : null,
    data,
  };
}

export type { CreateConversationOptions };
