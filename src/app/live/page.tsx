import { Suspense } from "react";
import { LiveSampleClient } from "@/components/LiveSampleClient";

/**
 * /live — safe sample / golden replay path for judges (demo insurance).
 * Always runs golden replay; use ?vertical=movers etc. to switch vertical.
 */
export default function LiveSamplePage() {
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
