import { NextRequest, NextResponse } from "next/server";
import { createIntakeDraft } from "@/lib/intake/draftStore";
import { tryGetAgentId } from "@/lib/elevenlabs/env";
import {
  getConversationSignedUrl,
  normalizeSignedUrl,
} from "@/lib/elevenlabs/conversations";
import { loadVertical } from "@/lib/config/loadVertical";

/**
 * POST /api/intake/start
 * Creates a durable intake draft (Neon) the UI polls; returns talk URL.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const vertical =
      typeof body.vertical === "string" ? body.vertical : "hvac";
    const verticalConfig = loadVertical(vertical);
    const draft = await createIntakeDraft(vertical);
    const agentId = tryGetAgentId("intake");

    let signed_url: string | null = null;
    if (agentId && process.env.ELEVENLABS_API_KEY) {
      try {
        const raw = await getConversationSignedUrl(agentId);
        signed_url = normalizeSignedUrl(raw);
      } catch (e) {
        console.warn("[intake/start] signed url failed", e);
      }
    }

    const dynamic_variables = {
      intake_id: draft.id,
      vertical,
      vertical_name: verticalConfig.displayName,
      intake_questions_json: JSON.stringify(verticalConfig.intake.questions),
    };
    let talk_url: string | null = null;
    if (agentId) {
      const talk = new URL("https://elevenlabs.io/app/talk-to");
      talk.searchParams.set("agent_id", agentId);
      talk.searchParams.set(
        "vars",
        Buffer.from(JSON.stringify(dynamic_variables), "utf8").toString(
          "base64",
        ),
      );
      talk_url = talk.toString();
    }

    return NextResponse.json({
      intake_id: draft.id,
      vertical,
      agent_id: agentId,
      signed_url,
      dynamic_variables,
      talk_url,
      poll_url: `/api/intake/status?intake_id=${draft.id}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
