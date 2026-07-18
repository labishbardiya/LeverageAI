import { getStore } from "@/lib/db";
import { publish } from "@/lib/db/events";

/** Persist every tool invocation for leverage-chain proof. */
export async function recordToolCall(input: {
  session_id?: string | null;
  job_id?: string | null;
  tool_name: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (!input.session_id) return;
  try {
    const store = getStore();
    const rec = await store.createToolCall({
      session_id: input.session_id,
      job_id: input.job_id ?? null,
      tool_name: input.tool_name,
      payload: input.payload,
    });
    if (input.job_id) {
      publish({
        type: "tool",
        job_id: input.job_id,
        session_id: input.session_id,
        payload: rec,
      });
    }
  } catch (e) {
    console.warn("[recordToolCall]", e);
  }
}
