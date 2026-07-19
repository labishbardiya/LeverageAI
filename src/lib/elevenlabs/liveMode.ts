/**
 * Live mode activates only when all 5 agent IDs, API key, and shared DB are present.
 * Otherwise sessions/start stays scaffold/replay-compatible.
 */
import { tryGetAgentId, getAllConfiguredAgentIds } from "./env";
import { hasDatabaseUrl } from "@/lib/db/pool";
import {
  blobStorageMode,
  hasDurableBlobStorage,
} from "@/lib/storage/blobAuth";

export function isLiveModeEnabled(): boolean {
  if (!process.env.ELEVENLABS_API_KEY || !hasDatabaseUrl()) return false;
  return (
    !!tryGetAgentId("intake") &&
    !!tryGetAgentId("negotiator") &&
    !!tryGetAgentId("tough") &&
    !!tryGetAgentId("stonewaller") &&
    !!tryGetAgentId("upseller")
  );
}

export function liveModeStatus() {
  const configured = getAllConfiguredAgentIds();
  const agents = Object.fromEntries(
    (["intake", "negotiator", "tough", "stonewaller", "upseller"] as const).map(
      (slot) => [slot, Boolean(configured[slot])],
    ),
  );
  return {
    enabled: isLiveModeEnabled(),
    agents,
    has_api_key: Boolean(process.env.ELEVENLABS_API_KEY),
    has_database: hasDatabaseUrl(),
    has_tool_auth: Boolean(process.env.TOOLS_WEBHOOK_SECRET?.trim()),
    has_post_call_auth: Boolean(
      process.env.ELEVENLABS_WEBHOOK_SECRET?.trim(),
    ),
    has_durable_recordings: hasDurableBlobStorage(),
    recording_storage: blobStorageMode(),
  };
}
