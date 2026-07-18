import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import path from "path";

/**
 * GET /api/demo/replay?vertical=hvac|movers
 * Serves golden run JSON for offline / replay demo.
 */
export async function GET(req: NextRequest) {
  const vertical = (
    req.nextUrl.searchParams.get("vertical") || "hvac"
  ).toLowerCase();

  const candidates =
    vertical === "movers"
      ? [
          path.join(process.cwd(), "data", "golden", "run-movers.json"),
          path.join(process.cwd(), "data", "golden", "run.json"),
        ]
      : [
          path.join(process.cwd(), "data", "golden", "run.json"),
          path.join(process.cwd(), "data", "golden", "run-movers.json"),
        ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const data = JSON.parse(readFileSync(filePath, "utf8"));
      return NextResponse.json(data, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (e) {
      return NextResponse.json(
        {
          error:
            e instanceof Error ? e.message : "Failed to parse golden run",
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    {
      error: "Golden run not found",
      path: "data/golden/run.json",
      hint: "Add a golden run JSON for offline demo replay",
    },
    { status: 404 },
  );
}
