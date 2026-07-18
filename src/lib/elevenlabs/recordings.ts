/**
 * Fetch conversation transcript + audio after a live session.
 * - Prefer Vercel Blob when BLOB_READ_WRITE_TOKEN is set (production)
 * - Else write under public/recordings (local only — not on Vercel FS)
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getElevenLabsApiKey } from "./env";
import { getStore } from "@/lib/db";

const API = "https://api.elevenlabs.io/v1";

async function putVercelBlob(
  sessionId: string,
  buf: Buffer
): Promise<string | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return null;
  try {
    // REST put without adding @vercel/blob dep if package missing
    const pathname = `recordings/${sessionId}.mp3`;
    const res = await fetch(
      `https://blob.vercel-storage.com/${pathname}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "audio/mpeg",
          "x-api-version": "7",
        },
        body: new Uint8Array(buf),
      }
    );
    if (!res.ok) {
      const t = await res.text();
      console.warn("[recordings] blob put failed", res.status, t.slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch (e) {
    console.warn("[recordings] blob error", e);
    return null;
  }
}

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
  let recording_note: string | null = "recording available in live mode only";

  try {
    const audioRes = await fetch(
      `${API}/convai/conversations/${conversationId}/audio`,
      { headers: { "xi-api-key": key } }
    );
    if (audioRes.ok) {
      const buf = Buffer.from(await audioRes.arrayBuffer());

      const blobUrl = await putVercelBlob(sessionId, buf);
      if (blobUrl) {
        audio_url = blobUrl;
        recording_note = null;
      } else if (process.env.VERCEL !== "1") {
        // Local writable FS only
        const dir = join(process.cwd(), "public", "recordings");
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const file = join(dir, `${sessionId}.mp3`);
        writeFileSync(file, buf);
        audio_url = `/recordings/${sessionId}.mp3`;
        recording_note = null;
      } else {
        recording_note =
          "Set BLOB_READ_WRITE_TOKEN — Vercel filesystem is read-only";
      }
    }
  } catch (e) {
    console.warn("[recordings] audio fetch failed", e);
  }

  await store.updateSession(sessionId, {
    audio_url,
    recording_note,
  });

  return { audio_url, meta };
}
