import { Suspense } from "react";
import { NegotiatorDashboard } from "@/components/NegotiatorDashboard";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Loading The Negotiator…</p>
        </div>
      }
    >
      <NegotiatorDashboard />
    </Suspense>
  );
}
