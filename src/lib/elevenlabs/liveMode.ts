/**
 * Live mode activates only when all 5 agent IDs + API key are present.
 * Otherwise sessions/start stays scaffold/replay-compatible.
 */
import { tryGetAgentId, getAllConfiguredAgentIds } from "./env";

export function isLiveModeEnabled(): boolean {
  if (!process.env.ELEVENLABS_API_KEY) return false;
  return (
    !!tryGetAgentId("intake") &&
    !!tryGetAgentId("negotiator") &&
    !!tryGetAgentId("tough") &&
    !!tryGetAgentId("stonewaller") &&
    !!tryGetAgentId("upseller")
  );
}

export function liveModeStatus() {
  return {
    enabled: isLiveModeEnabled(),
    agents: getAllConfiguredAgentIds(),
    has_api_key: Boolean(process.env.ELEVENLABS_API_KEY),
  };
}
