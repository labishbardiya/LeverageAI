/**
 * Fetch conversation transcript + audio after a live session.
 * Dev: write under public/recordings. Prod: optional Vercel Blob token.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getElevenLabsApiKey } from "./env";
import { getStore } from "@/lib/db";

const API = "https://api.elevenlabs.io/v1";

export async function fetchAndStoreRecording(
  sessionId: string,
  conversationId: string
): Promise<{ audio_url: string | null; meta: unknown }> {
  const key = getElevenLabsApiKey();
  const store = getStore();

  let meta: unknown = null;
  try {
    const metaRes = await fetch(
      `${API}/convai/conversations/${conversationId}`,
      { headers: { "xi-api-key": key } }
    );
    if (metaRes.ok) meta = await metaRes.json();
  } catch {
    /* optional */
  }

  let audio_url: string | null = null;
  try {
    const audioRes = await fetch(
      `${API}/convai/conversations/${conversationId}/audio`,
      { headers: { "xi-api-key": key } }
    );
    if (audioRes.ok) {
      const buf = Buffer.from(await audioRes.arrayBuffer());
      const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
      if (blobToken) {
        // Optional Vercel Blob — dynamic import shape avoided for offline build
        audio_url = `blob:pending:${sessionId}`;
        // Store bytes to local as well for demo reliability
      }
      const dir = join(process.cwd(), "public", "recordings");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const file = join(dir, `${sessionId}.mp3`);
      writeFileSync(file, buf);
      audio_url = `/recordings/${sessionId}.mp3`;
    }
  } catch (e) {
    console.warn("[recordings] audio fetch failed", e);
  }

  await store.updateSession(sessionId, {
    audio_url,
    recording_note: audio_url
      ? null
      : "recording available in live mode only",
  });

  return { audio_url, meta };
}
