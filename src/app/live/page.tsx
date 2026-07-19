import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LiveSampleClient } from "@/components/LiveSampleClient";

/**
 * /live — safe sample / golden replay path for judges (demo insurance).
 * Always runs golden replay; use ?vertical=movers etc. to switch vertical.
 */
export default async function LiveSamplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const replay = Array.isArray(params.replay) ? params.replay[0] : params.replay;
  if (!replay || !["true", "live", "1"].includes(replay)) {
    const next = new URLSearchParams();
    const vertical = Array.isArray(params.vertical)
      ? params.vertical[0]
      : params.vertical;
    if (vertical) next.set("vertical", vertical);
    next.set("replay", "true");
    redirect(`/live?${next.toString()}`);
  }
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-screen items-center justify-center text-[var(--ink-secondary)]">
          <div className="cloud-sky" aria-hidden>
            <div className="cloud cloud-a" />
            <div className="cloud cloud-b" />
          </div>
          <p className="relative z-10">Loading sample…</p>
        </div>
      }
    >
      <LiveSampleClient />
    </Suspense>
  );
}
