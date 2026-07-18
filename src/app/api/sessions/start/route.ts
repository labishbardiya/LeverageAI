import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/db";
import {
  loadVertical,
  toPublicVertical,
} from "@/lib/config/loadVertical";
import { publish } from "@/lib/db/events";

const schema = z.object({
  job_id: z.string().uuid(),
});

/**
 * POST /api/sessions/start — for confirmed job, create 3 sessions from config vendors.
 * Response vendors are public-only (pricing_strategy_secret stripped).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const store = getStore();
    const job = await store.getJob(parsed.data.job_id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!job.confirmed) {
      return NextResponse.json(
        { error: "Job must be confirmed before starting sessions" },
        { status: 400 }
      );
    }

    const existing = await store.listSessionsByJob(job.id);
    if (existing.length > 0) {
      return NextResponse.json({
        sessions: existing,
        already_started: true,
        job_id: job.id,
      });
    }

    let vertical;
    try {
      vertical = loadVertical(job.vertical);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Vertical error" },
        { status: 400 }
      );
    }

    const sessions = [];
    for (const vendor of vertical.vendors) {
      const session = await store.createSession({
        job_id: job.id,
        vendor_id: vendor.id,
        vendor_name: vendor.name ?? vendor.displayName,
        status: "pending",
      });
      sessions.push(session);
      publish({
        type: "session",
        job_id: job.id,
        session_id: session.id,
        payload: session,
      });
    }

    await store.updateJob(job.id, { status: "running" });

    const pub = toPublicVertical(vertical);

    return NextResponse.json(
      {
        job_id: job.id,
        sessions,
        vendors: pub.vendors.map((v) => ({
          id: v.id,
          name: v.name ?? v.displayName,
          displayName: v.displayName,
          persona: v.persona ?? v.role,
          role: v.role,
          role_label: v.role_label,
          public_blurb: v.public_blurb,
        })),
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[POST /api/sessions/start]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
