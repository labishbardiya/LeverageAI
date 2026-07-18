/**
 * Optional shared secret for /api/tools/* webhooks.
 * When TOOLS_WEBHOOK_SECRET is set, require matching header.
 * Accepts: Authorization: Bearer <secret> OR x-leverageai-secret: <secret>
 */
import { NextRequest, NextResponse } from "next/server";

export function requireToolWebhookAuth(
  req: NextRequest
): NextResponse | null {
  const secret = process.env.TOOLS_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Open in local demo when unset — never deploy without this
    return null;
  }

  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const headerSecret =
    req.headers.get("x-leverageai-secret") ||
    req.headers.get("x-tools-webhook-secret") ||
    "";

  if (bearer === secret || headerSecret === secret) {
    return null;
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Unauthorized tool webhook",
      code: "UNAUTHORIZED",
    },
    { status: 401 }
  );
}
