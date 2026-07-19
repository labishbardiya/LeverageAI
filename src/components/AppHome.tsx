"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SplashIntro } from "./SplashIntro";
import { NegotiatorDashboard } from "./NegotiatorDashboard";

const SPLASH_KEY = "leverageai_splash_seen";

/**
 * Landing shell: Sarvam-style logo moment, then main product window.
 * Splash once per browser session (vertical switches skip it).
 * Force with ?splash=1 · skip with ?skip_splash=1
 */
export function AppHome() {
  const searchParams = useSearchParams();
  const forceSplash = searchParams.get("splash") === "1";
  const skipSplash = searchParams.get("skip_splash") === "1";

  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (skipSplash && !forceSplash) {
      setShowSplash(false);
      setReady(true);
      return;
    }
    if (forceSplash) {
      setShowSplash(true);
      setReady(true);
      return;
    }
    try {
      const seen = sessionStorage.getItem(SPLASH_KEY);
      setShowSplash(!seen);
    } catch {
      setShowSplash(true);
    }
    setReady(true);
  }, [forceSplash, skipSplash]);

  const onSplashDone = useCallback(() => {
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowSplash(false);
  }, []);

  if (!ready) {
    return (
      <div className="ambient-root flex min-h-screen items-center justify-center">
        <div className="ambient-bg" aria-hidden>
          <div className="ambient-orb ambient-orb-1" />
          <div className="ambient-orb ambient-orb-2" />
          <div className="ambient-orb ambient-orb-3" />
        </div>
      </div>
    );
  }

  if (showSplash) {
    return <SplashIntro onDone={onSplashDone} />;
  }

  return (
    <div className="app-enter">
      <NegotiatorDashboard />
    </div>
  );
}
