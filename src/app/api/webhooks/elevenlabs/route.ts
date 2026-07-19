import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { storeRecordingBuffer } from "@/lib/elevenlabs/recordings";
import { verifyElevenLabsWebhook } from "@/lib/security/elevenlabsWebhook";
import type { Session } from "@/lib/types";

export const runtime = "nodejs";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dynamicSessionId(data: UnknownRecord): string | null {
  const initiation = record(data.conversation_initiation_client_data);
  const dynamicVariables = record(
    initiation.dynamic_variables ?? data.dynamic_variables
  );
  return stringValue(dynamicVariables.session_id);
}

async function resolveSession(
  conversationId: string | null,
  data: UnknownRecord
): Promise<Session | null> {
  const store = getStore();
  if (conversationId) {
    const byConversation = await store.findSessionByConversationId(conversationId);
    if (byConversation) return byConversation;
  }
  const sessionId = dynamicSessionId(data);
  return sessionId ? store.getSession(sessionId) : null;
}

function transcriptSpeaker(
  role: string,
  session: Session,
  conversationId: string
): "negotiator" | "vendor" | "system" {
  const isCounter = session.counter_conversation_id === conversationId;
  if (role === "agent") return isCounter ? "vendor" : "negotiator";
  if (role === "user") return isCounter ? "negotiator" : "vendor";
  return "system";
}

async function ingestTranscript(
  session: Session,
  conversationId: string,
  data: UnknownRecord
): Promise<number> {
  const store = getStore();
  const incoming = Array.isArray(data.transcript) ? data.transcript : [];
  const existing = await store.listTranscriptsBySession(session.id, 1000);
  const existingCounts = new Map<string, number>();
  for (const event of existing) {
    const key = `${event.speaker}\u0000${event.text.trim()}`;
    existingCounts.set(key, (existingCounts.get(key) ?? 0) + 1);
  }

  let added = 0;
  for (let index = 0; index < incoming.length; index += 1) {
    const turn = record(incoming[index]);
    const text = stringValue(turn.message ?? turn.text);
    if (!text) continue;
    const role = stringValue(turn.role) ?? "unknown";
    const speaker = transcriptSpeaker(role, session, conversationId);
    const key = `${speaker}\u0000${text}`;
    const duplicateCount = existingCounts.get(key) ?? 0;
    if (duplicateCount > 0) {
      existingCounts.set(key, duplicateCount - 1);
      continue;
    }
    const seconds = Number(turn.time_in_call_secs ?? turn.time_in_call_seconds);
    await store.appendTranscript({
      session_id: session.id,
      ts_ms: Number.isFinite(seconds) ? Math.round(seconds * 1000) : index * 1000,
      speaker,
      text,
    });
    added += 1;
  }
  return added;
}

export async function POST(request: Request) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "ElevenLabs webhook secret is not configured" },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const verification = verifyElevenLabsWebhook({
    rawBody,
    signatureHeader: request.headers.get("elevenlabs-signature"),
    secret,
  });
  if (!verification.ok) {
    return NextResponse.json({ error: verification.reason }, { status: 401 });
  }

  let payload: UnknownRecord;
  try {
    payload = record(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = stringValue(payload.type);
  const data = record(payload.data);
  const conversationId = stringValue(data.conversation_id);
  const session = await resolveSession(conversationId, data);
  if (!session || !conversationId) {
    return NextResponse.json(
      { error: "No matching session for conversation" },
      { status: 404 }
    );
  }

  if (type === "post_call_transcription") {
    const added = await ingestTranscript(session, conversationId, data);
    return NextResponse.json({ ok: true, type, added });
  }

  if (type === "post_call_audio") {
    // Prefer the negotiator-side recording; it is the canonical evidence track.
    if (
      session.audio_url &&
      session.counter_conversation_id === conversationId
    ) {
      return NextResponse.json({ ok: true, type, stored: false, reason: "canonical_recording_exists" });
    }
    const encoded = stringValue(data.full_audio ?? data.audio_base_64);
    if (!encoded) {
      return NextResponse.json({ error: "Audio payload is missing" }, { status: 400 });
    }
    const audioUrl = await storeRecordingBuffer(
      session.id,
      Buffer.from(encoded, "base64")
    );
    return NextResponse.json({ ok: true, type, stored: Boolean(audioUrl), audio_url: audioUrl });
  }

  return NextResponse.json({ ok: true, ignored: true, type });
}
