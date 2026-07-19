import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function parseSignature(header: string): { timestamp: number; digest: string } | null {
  const values = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    })
  );
  const timestamp = Number(values.t);
  if (!Number.isFinite(timestamp) || !values.v0) return null;
  return { timestamp, digest: values.v0 };
}

export function verifyElevenLabsWebhook(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): { ok: true } | { ok: false; reason: string } {
  const parsed = input.signatureHeader
    ? parseSignature(input.signatureHeader)
    : null;
  if (!parsed) return { ok: false, reason: "Missing or malformed signature" };

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const tolerance = input.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - parsed.timestamp) > tolerance) {
    return { ok: false, reason: "Signature timestamp is outside tolerance" };
  }

  const expected = createHmac("sha256", input.secret)
    .update(`${parsed.timestamp}.${input.rawBody}`, "utf8")
    .digest("hex");
  const actualBuffer = Buffer.from(parsed.digest, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: "Signature mismatch" };
  }
  return { ok: true };
}
