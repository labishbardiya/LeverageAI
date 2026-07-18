/**
 * ElevenLabs agent IDs and API key from environment.
 * Secrets never hard-coded — see AGENTS.md.
 */

export type NegotiatorAgentSlot =
  | "intake"
  | "negotiator"
  | "tough"
  | "stonewaller"
  | "upseller";

const AGENT_ENV_KEYS: Record<NegotiatorAgentSlot, string> = {
  intake: "ELEVENLABS_INTAKE_AGENT_ID",
  negotiator: "ELEVENLABS_NEGOTIATOR_AGENT_ID",
  tough: "ELEVENLABS_TOUGH_AGENT_ID",
  stonewaller: "ELEVENLABS_STONEWALLER_AGENT_ID",
  upseller: "ELEVENLABS_UPSELLER_AGENT_ID",
};

export function getElevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }
  return key;
}

export function getAgentId(slot: NegotiatorAgentSlot): string {
  const envKey = AGENT_ENV_KEYS[slot];
  const id = process.env[envKey];
  if (!id) {
    throw new Error(`${envKey} is not set`);
  }
  return id;
}

/** Returns null instead of throwing when an agent is not configured yet. */
export function tryGetAgentId(slot: NegotiatorAgentSlot): string | null {
  return process.env[AGENT_ENV_KEYS[slot]] ?? null;
}

export function getAllConfiguredAgentIds(): Partial<
  Record<NegotiatorAgentSlot, string>
> {
  const out: Partial<Record<NegotiatorAgentSlot, string>> = {};
  for (const slot of Object.keys(AGENT_ENV_KEYS) as NegotiatorAgentSlot[]) {
    const id = tryGetAgentId(slot);
    if (id) out[slot] = id;
  }
  return out;
}

export type CounterAgentSlot = "tough" | "stonewaller" | "upseller";

/** Counter-agent slots only — never merge with negotiator prompt loading. */
export const COUNTER_AGENT_SLOTS: readonly CounterAgentSlot[] = [
  "tough",
  "stonewaller",
  "upseller",
] as const;

export function isCounterAgentSlot(
  slot: NegotiatorAgentSlot
): slot is CounterAgentSlot {
  return (COUNTER_AGENT_SLOTS as readonly string[]).includes(slot);
}
