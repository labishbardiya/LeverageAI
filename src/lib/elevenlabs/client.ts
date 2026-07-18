/**
 * Minimal ElevenLabs REST fetch wrapper.
 * Uses Conversational AI / Agents HTTP APIs only — no custom STT/TTS.
 */

import { getElevenLabsApiKey } from "./env";
import type { ElevenLabsErrorBody } from "./types";

export const ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1";

export class ElevenLabsApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `ElevenLabs API error ${status}`);
    this.name = "ElevenLabsApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ElevenLabsFetchOptions extends Omit<RequestInit, "body"> {
  /** JSON body — serialized automatically. */
  json?: unknown;
  /** Raw body if not using json. */
  body?: BodyInit | null;
  /** Override API key (tests). Default: ELEVENLABS_API_KEY. */
  apiKey?: string;
}

/**
 * Authenticated fetch against api.elevenlabs.io.
 * Path may be absolute URL or path under /v1 (with or without leading slash).
 */
export async function elevenLabsFetch<T = unknown>(
  path: string,
  options: ElevenLabsFetchOptions = {}
): Promise<T> {
  const { json, apiKey, headers: initHeaders, body, ...rest } = options;
  const key = apiKey ?? getElevenLabsApiKey();

  const url = path.startsWith("http")
    ? path
    : `${ELEVENLABS_API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(initHeaders);
  headers.set("xi-api-key", key);
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    body: json !== undefined ? JSON.stringify(json) : body,
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const errBody = parsed as ElevenLabsErrorBody;
    const msg =
      typeof errBody?.message === "string"
        ? errBody.message
        : typeof parsed === "string"
          ? parsed
          : `ElevenLabs API error ${res.status}`;
    throw new ElevenLabsApiError(res.status, parsed, msg);
  }

  return parsed as T;
}
