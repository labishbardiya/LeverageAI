import { Suspense } from "react";
import { AppHome } from "@/components/AppHome";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="ambient-root flex min-h-screen items-center justify-center">
          <div className="ambient-bg" aria-hidden>
            <div className="ambient-orb ambient-orb-1" />
            <div className="ambient-orb ambient-orb-2" />
            <div className="ambient-orb ambient-orb-3" />
          </div>
        </div>
      }
    >
      <AppHome />
    </Suspense>
  );
}
