/**
 * Production telephony path (chosen-not-built for the hackathon MVP).
 *
 * ElevenLabs Agents Platform supports native Twilio / SIP outbound.
 * This module is the outbound-call interface with a NOT_ENABLED guard so
 * we never pretend PSTN is live in the demo.
 *
 * See README § "Production telephony path".
 */

export type OutboundCallRequest = {
  toE164: string;
  agentId: string;
  jobId: string;
  sessionId: string;
  /** Dynamic variables for the agent conversation */
  dynamicVariables?: Record<string, string>;
};

export type OutboundCallResult =
  | { ok: true; callSid: string }
  | { ok: false; code: "NOT_ENABLED"; error: string };

/**
 * Place a real outbound call via ElevenLabs ↔ Twilio.
 * Disabled in this MVP — counter-agents stand in for market styles.
 */
export async function placeOutboundCall(
  _req: OutboundCallRequest
): Promise<OutboundCallResult> {
  return {
    ok: false,
    code: "NOT_ENABLED",
    error:
      "Production telephony path not enabled. Use ElevenLabs native Twilio integration with real Places numbers. Today three negotiation-style counter-agents stand in (brief-allowed).",
  };
}

export function telephonyEnabled(): boolean {
  return (
    process.env.TWILIO_ACCOUNT_SID != null &&
    process.env.TWILIO_AUTH_TOKEN != null &&
    process.env.ENABLE_TWILIO_OUTBOUND === "true"
  );
}
