/**
 * Agent-to-agent WebSocket bridge relay.
 * ElevenLabs has no native server-side agent↔agent mode, so we open two
 * conversation sockets and relay audio / interruption frames.
 *
 * When live credentials are missing, callers must not invoke this module.
 */
import WebSocket from "ws";
import type { BridgePairIntent } from "./types";
import { getElevenLabsApiKey } from "./env";
import { getStore } from "@/lib/db";
import { publish } from "@/lib/db/events";
const WATCHDOG_MS = 90_000;
const WS_URL = "wss://api.elevenlabs.io/v1/convai/conversation";

export type BridgeResult = {
  sessionId: string;
  negotiatorConversationId: string | null;
  counterConversationId: string | null;
  ok: boolean;
  error?: string;
};

type JsonMsg = Record<string, unknown>;

function asObj(data: WebSocket.RawData): JsonMsg | null {
  try {
    const text =
      typeof data === "string" ? data : Buffer.from(data as Buffer).toString("utf8");
    return JSON.parse(text) as JsonMsg;
  } catch {
    return null;
  }
}

function openConversationSocket(
  agentId: string,
  apiKey: string
): Promise<{ ws: WebSocket; conversationId: string | null }> {
  return new Promise((resolve, reject) => {
    const url = `${WS_URL}?agent_id=${encodeURIComponent(agentId)}`;
    const ws = new WebSocket(url, {
      headers: { "xi-api-key": apiKey },
    });
    let conversationId: string | null = null;
    const timer = setTimeout(() => {
      reject(new Error(`WS open timeout for agent ${agentId}`));
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }, 15_000);

    ws.on("open", () => {
      clearTimeout(timer);
      // Conversation initiation — dynamic variables applied via conversation_initiation_client_data
      resolve({ ws, conversationId });
    });
    ws.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    ws.on("message", (raw) => {
      const msg = asObj(raw);
      if (!msg) return;
      const cid =
        (msg.conversation_id as string) ||
        (msg.conversationId as string) ||
        ((msg.conversation_initiation_metadata_event as JsonMsg | undefined)
          ?.conversation_id as string | undefined);
      if (cid) conversationId = cid;
    });
  });
}

function sendInit(
  ws: WebSocket,
  intent: BridgePairIntent,
  role: "negotiator" | "counter"
) {
  const payload = {
    type: "conversation_initiation_client_data",
    conversation_config_override: {
      agent: {
        // first message left to agent prompt
      },
    },
    dynamic_variables: {
      job_id: intent.jobId,
      session_id: intent.sessionId,
      company_key: intent.companyKey,
      job_spec_json: intent.jobSpecJson,
      bridge_role: role,
    },
  };
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function isAudioEvent(msg: JsonMsg): boolean {
  const t = String(msg.type || msg.event || "");
  return (
    t.includes("audio") ||
    Boolean(msg.audio_event) ||
    Boolean(msg.audio) ||
    t === "user_audio_chunk"
  );
}

function isInterruptEvent(msg: JsonMsg): boolean {
  const t = String(msg.type || msg.event || "");
  return t.includes("interrupt") || t.includes("barge") || t === "interruption";
}

function extractTranscript(msg: JsonMsg): { speaker: string; text: string } | null {
  const t = String(msg.type || "");
  if (t.includes("transcript") || msg.user_transcription_event || msg.agent_response_event) {
    const user = msg.user_transcription_event as JsonMsg | undefined;
    const agent = msg.agent_response_event as JsonMsg | undefined;
    if (user?.user_transcript) {
      return { speaker: "vendor", text: String(user.user_transcript) };
    }
    if (agent?.agent_response) {
      return { speaker: "negotiator", text: String(agent.agent_response) };
    }
    if (typeof msg.text === "string") {
      return {
        speaker: t.includes("user") ? "vendor" : "negotiator",
        text: msg.text,
      };
    }
  }
  return null;
}

/**
 * Run one negotiator↔counter bridge until both sides close or watchdog fires.
 * Sessions are intended to run sequentially by the caller.
 */
export async function runAgentBridge(
  intent: BridgePairIntent
): Promise<BridgeResult> {
  const apiKey = getElevenLabsApiKey();
  const store = getStore();
  let lastEvent = Date.now();
  let closed = false;

  let negWs: WebSocket | null = null;
  let ctrWs: WebSocket | null = null;
  let negCid: string | null = null;
  let ctrCid: string | null = null;

  const touch = () => {
    lastEvent = Date.now();
    void store.updateSession(intent.sessionId, {
      last_event_at: new Date().toISOString(),
    });
  };

  const forceTimeout = async () => {
    if (closed) return;
    closed = true;
    await store.closeSession(
      intent.sessionId,
      "documented_decline",
      "timeout: no events for 90s"
    );
    publish({
      type: "session",
      job_id: intent.jobId,
      session_id: intent.sessionId,
      payload: { outcome: "documented_decline", reason: "timeout" },
    });
    try {
      negWs?.close();
      ctrWs?.close();
    } catch {
      /* ignore */
    }
  };

  const watchdog = setInterval(() => {
    if (Date.now() - lastEvent > WATCHDOG_MS) {
      void forceTimeout();
      clearInterval(watchdog);
    }
  }, 5_000);

  try {
    await store.updateSession(intent.sessionId, { status: "connecting" });

    const [neg, ctr] = await Promise.all([
      openConversationSocket(intent.negotiatorAgentId, apiKey),
      openConversationSocket(intent.counterAgentId, apiKey),
    ]);
    negWs = neg.ws;
    ctrWs = ctr.ws;
    negCid = neg.conversationId;
    ctrCid = ctr.conversationId;

    sendInit(negWs, intent, "negotiator");
    sendInit(ctrWs, intent, "counter");

    await store.updateSession(intent.sessionId, {
      status: "live",
      negotiator_conversation_id: negCid,
      counter_conversation_id: ctrCid,
      last_event_at: new Date().toISOString(),
    });

    const relay = (
      from: WebSocket,
      to: WebSocket,
      fromRole: "negotiator" | "counter"
    ) => {
      from.on("message", (raw) => {
        touch();
        const msg = asObj(raw);
        if (!msg) {
          // binary audio — forward as-is if peer open
          if (to.readyState === WebSocket.OPEN) to.send(raw);
          return;
        }

        // Capture conversation ids
        const cid =
          (msg.conversation_id as string) ||
          (msg.conversationId as string) ||
          null;
        if (cid) {
          if (fromRole === "negotiator") negCid = cid;
          else ctrCid = cid;
        }

        const tr = extractTranscript(msg);
        if (tr) {
          const speaker =
            fromRole === "negotiator" ? tr.speaker : tr.speaker === "negotiator" ? "vendor" : "negotiator";
          void store.appendTranscript({
            session_id: intent.sessionId,
            ts_ms: Date.now() % 1_000_000,
            speaker,
            text: tr.text,
          });
          publish({
            type: "transcript",
            job_id: intent.jobId,
            session_id: intent.sessionId,
            payload: { speaker, text: tr.text },
          });
        }

        // Relay audio / interruption to peer as user input when possible
        if (to.readyState !== WebSocket.OPEN) return;

        if (isInterruptEvent(msg)) {
          to.send(JSON.stringify({ type: "interruption", ...msg }));
          return;
        }

        if (isAudioEvent(msg)) {
          // Forward agent audio as user_audio_chunk when base64 present
          const audioEvent = (msg.audio_event as JsonMsg) || msg;
          const b64 =
            (audioEvent.audio_base_64 as string) ||
            (audioEvent.audioBase64 as string) ||
            (msg.audio_base_64 as string) ||
            (msg.chunk as string);
          if (b64) {
            to.send(
              JSON.stringify({
                user_audio_chunk: b64,
              })
            );
          } else {
            to.send(JSON.stringify(msg));
          }
          return;
        }

        // Pass-through other control frames sparingly
        if (msg.type === "ping" || msg.type === "pong") {
          to.send(JSON.stringify(msg));
        }
      });
    };

    relay(negWs, ctrWs, "negotiator");
    relay(ctrWs, negWs, "counter");

    await new Promise<void>((resolve) => {
      const done = () => {
        if (closed) return;
        closed = true;
        clearInterval(watchdog);
        resolve();
      };
      negWs!.on("close", done);
      ctrWs!.on("close", done);
      // Max session wall clock 8 minutes for hackathon demos
      setTimeout(done, 8 * 60_000);
    });

    await store.updateSession(intent.sessionId, {
      negotiator_conversation_id: negCid,
      counter_conversation_id: ctrCid,
      last_event_at: new Date().toISOString(),
    });

    return {
      sessionId: intent.sessionId,
      negotiatorConversationId: negCid,
      counterConversationId: ctrCid,
      ok: true,
    };
  } catch (e) {
    clearInterval(watchdog);
    const error = e instanceof Error ? e.message : String(e);
    await store.updateSession(intent.sessionId, {
      status: "error",
      recording_note: error,
    });
    return {
      sessionId: intent.sessionId,
      negotiatorConversationId: negCid,
      counterConversationId: ctrCid,
      ok: false,
      error,
    };
  } finally {
    clearInterval(watchdog);
    try {
      negWs?.close();
      ctrWs?.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Run bridges sequentially for clean tool logs / concurrency limits.
 */
export async function runBridgesSequential(
  intents: BridgePairIntent[]
): Promise<BridgeResult[]> {
  const results: BridgeResult[] = [];
  for (const intent of intents) {
    results.push(await runAgentBridge(intent));
  }
  return results;
}
