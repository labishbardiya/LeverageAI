import { Suspense } from "react";
import { ProductWorkspace } from "@/components/ProductWorkspace";

/**
 * /livee — live product shell (alias of full ProductWorkspace).
 */
export default function LiveePage() {
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-screen items-center justify-center text-[var(--ink-muted)]">
          <div className="cloud-sky" aria-hidden>
            <div className="cloud cloud-a" />
            <div className="cloud cloud-b" />
          </div>
          <p className="relative z-10">Loading…</p>
        </div>
      }
    >
      <ProductWorkspace />
    </Suspense>
  );
}
