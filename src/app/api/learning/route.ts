import { NextRequest, NextResponse } from "next/server";
import { getPlaybook } from "@/lib/learning/extract";
import { selectTacticsUcb } from "@/lib/learning/bandit";
import { getStore } from "@/lib/db";

/** GET /api/learning?vertical=hvac — UCB1 playbook + tactic leaderboard */
export async function GET(req: NextRequest) {
  try {
    const vertical = req.nextUrl.searchParams.get("vertical") || "hvac";
    const jobId = req.nextUrl.searchParams.get("job_id");
    const playbook = await getPlaybook(vertical);
    const ucb = await selectTacticsUcb(vertical, 3);
    const selectedForJob = new Set<string>();
    if (jobId) {
      const calls = await getStore().listToolCallsByJob(jobId);
      for (const call of calls) {
        if (call.tool_name !== "learning_selection") continue;
        const tactics = call.payload.selected_tactics;
        if (Array.isArray(tactics)) {
          for (const tactic of tactics) {
            if (typeof tactic === "string") selectedForJob.add(tactic);
          }
        }
      }
    }
    const comparison = playbook.rows.map((row) => ({
      tactic: row.tactic,
      selected_for_this_run: selectedForJob.has(row.tactic),
      sample_count: row.sample_count,
      average_price_improvement_pct: Math.max(0, -row.outcome_delta),
      confidence: 1 - Math.exp(-row.sample_count / 5),
      evidence: row.sample_count
        ? `${row.sample_count} completed-call observation${row.sample_count === 1 ? "" : "s"}`
        : "No completed-call evidence yet",
    }));
    return NextResponse.json({
      ...playbook,
      method: "UCB1",
      selected_tactics: ucb.tactics,
      ucb_arms: ucb.arms,
      ucb_sentences: ucb.sentences,
      comparison,
      best_observed_tactic:
        comparison
          .filter((row) => row.sample_count > 0)
          .sort(
            (a, b) =>
              b.average_price_improvement_pct -
              a.average_price_improvement_pct,
          )[0] || null,
      learning_claim:
        "Constrained UCB1: explores uncertain tactics, exploits observed winners, and never changes honesty or quote-validation rules.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed" },
      { status: 500 }
    );
  }
}
