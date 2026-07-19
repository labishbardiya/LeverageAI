"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NegotiatorDashboard } from "./NegotiatorDashboard";

/**
 * Ensures /live always has replay=true so judges get the golden path
 * even when opening the bare URL. Waits to mount dashboard until ready.
 */
export function LiveSampleClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const replay = searchParams.get("replay");
  const ready =
    replay === "true" || replay === "live" || replay === "1";

  useEffect(() => {
    if (!ready) {
      const q = new URLSearchParams(searchParams.toString());
      q.set("replay", "true");
      router.replace(`/live?${q.toString()}`);
    }
  }, [ready, router, searchParams]);

  if (!ready) {
    return (
      <div className="relative flex min-h-screen items-center justify-center text-[var(--ink-secondary)]">
        <div className="cloud-sky" aria-hidden>
          <div className="cloud cloud-a" />
          <div className="cloud cloud-b" />
        </div>
        <p className="relative z-10">Loading sample…</p>
      </div>
    );
  }

  return <NegotiatorDashboard />;
}
