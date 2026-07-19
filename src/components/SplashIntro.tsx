"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  onDone: () => void;
};

/**
 * Sarvam-style land: full ambient canvas + big Leverage.AI wordmark,
 * then hand off to the main product window.
 */
export function SplashIntro({ onDone }: Props) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  const finish = useCallback(() => {
    setPhase((p) => (p === "exit" ? p : "exit"));
  }, []);

  useEffect(() => {
    // Enter → hold → exit timeline
    const tEnter = window.setTimeout(() => setPhase("hold"), 700);
    const tExit = window.setTimeout(() => setPhase("exit"), 2400);
    return () => {
      window.clearTimeout(tEnter);
      window.clearTimeout(tExit);
    };
  }, []);

  useEffect(() => {
    if (phase !== "exit") return;
    const t = window.setTimeout(() => onDone(), 720);
    return () => window.clearTimeout(t);
  }, [phase, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish]);

  return (
    <div
      className={`splash-root ${phase === "exit" ? "splash-exit" : ""} ${
        phase === "enter" ? "splash-enter" : ""
      }`}
      role="dialog"
      aria-label="Leverage.AI"
      onClick={finish}
    >
      <div className="ambient-bg" aria-hidden>
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
        <div className="ambient-mesh" />
      </div>

      <div className="splash-content">
        <div className="splash-mark" aria-hidden>
          <div className="audio-sphere splash-sphere" />
        </div>

        <h1 className="splash-wordmark">
          <span className="splash-word-leverage">Leverage</span>
          <span className="splash-word-ai">.AI</span>
        </h1>

        <p className="splash-tagline">
          Multi-agent negotiation · honest leverage
        </p>

        <button
          type="button"
          className="splash-enter-btn"
          onClick={(e) => {
            e.stopPropagation();
            finish();
          }}
        >
          Enter
        </button>

        <p className="splash-hint">Click anywhere or press Enter</p>
      </div>
    </div>
  );
}
