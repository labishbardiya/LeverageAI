import { NextRequest, NextResponse } from "next/server";
import {
  loadVerticalPublic,
  listVerticalIds,
  resolveVerticalId,
} from "@/lib/config/loadVertical";

/**
 * GET /api/vertical?id=hvac|movers
 * Returns public vertical config (pricing secrets stripped).
 */
export async function GET(req: NextRequest) {
  const id = resolveVerticalId(req.nextUrl.searchParams.get("id"));

  try {
    const config = loadVerticalPublic(id);
    return NextResponse.json(config, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const available = listVerticalIds();
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Vertical not found",
        available,
      },
      { status: 404 },
    );
  }
}
