/**
 * ElevenLabs Agents — thin client surface for The Negotiator.
 * No custom STT/TTS. Counter-agent prompts stay isolated in agents/prompts.
 */

export {
  getElevenLabsApiKey,
  getAgentId,
  tryGetAgentId,
  getAllConfiguredAgentIds,
  COUNTER_AGENT_SLOTS,
  isCounterAgentSlot,
  type NegotiatorAgentSlot,
  type CounterAgentSlot,
} from "./env";

export {
  ELEVENLABS_API_BASE,
  ElevenLabsApiError,
  elevenLabsFetch,
  type ElevenLabsFetchOptions,
} from "./client";

export {
  getConversationSignedUrl,
  getConversationToken,
  normalizeSignedUrl,
  normalizeConversationId,
  buildNegotiatorDynamicVariables,
  buildIntakeDynamicVariables,
  startAgentSession,
  buildTripleBridgeIntents,
  parseElevenLabsWebhookBody,
} from "./conversations";

export type {
  ConversationDynamicVariables,
  CreateConversationOptions,
  SignedUrlResponse,
  ConversationTokenResponse,
  ConversationRef,
  TranscriptSegment,
  ElevenLabsWebhookStub,
  CallOutcome,
  BridgePairIntent,
  ElevenLabsErrorBody,
} from "./types";

export { isLiveModeEnabled, liveModeStatus } from "./liveMode";
export { runAgentBridge, runBridgesSequential } from "./bridge";
export { fetchAndStoreRecording } from "./recordings";
