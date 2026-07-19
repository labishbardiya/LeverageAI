import { NextRequest, NextResponse } from "next/server";
import { getIntakeDraft, getLatestFilled } from "@/lib/intake/draftStore";

/** GET /api/intake/status?intake_id=...&vertical=hvac */
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("intake_id");
    const vertical = req.nextUrl.searchParams.get("vertical") || "hvac";
    const draft = id
      ? await getIntakeDraft(id)
      : await getLatestFilled(vertical);
    return NextResponse.json({
      draft,
      intake_id: draft?.id ?? null,
      status: draft?.status ?? "missing",
      job_spec: draft?.job_spec ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed", draft: null },
      { status: 500 }
    );
  }
}
