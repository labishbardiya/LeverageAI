"use client";

import { useRouter } from "next/navigation";

/**
 * Landing — same LEVERAGE wordmark placement as live portal (no A icon).
 * Close Smart Deals = real buttons (header + under headline).
 */
export function LandingPage() {
  const router = useRouter();
  const goPortal = () => router.push("/livee");

  return (
    <div className="landing-outer">
      <div className="landing-frame">
        <div className="cloud-sky landing-sky" aria-hidden>
          <video
            className="cloud-video"
            autoPlay
            muted
            loop
            playsInline
            poster="/media/clouds-poster.jpg"
          >
            <source src="/media/clouds-loop.mp4" type="video/mp4" />
          </video>
          <div className="cloud cloud-a" />
          <div className="cloud cloud-b" />
          <div className="cloud cloud-c" />
          <div className="landing-sky-veil" />
        </div>

        {/* Same shell as ProductWorkspace header */}
        <header className="portal-header-merge sticky top-0 z-30">
          <div className="mx-auto flex max-w-[var(--max)] items-center justify-between px-4 py-4 sm:px-6">
            <span className="logo-leverage logo-plain" aria-label="LEVERAGE">
              LEVERAGE
            </span>
            <button
              type="button"
              className="btn-close-smart-deals"
              onClick={goPortal}
            >
              Close Smart Deals
              <span aria-hidden>→</span>
            </button>
          </div>
        </header>

        <main className="landing-main">
          <section className="landing-hero">
            <h1 className="landing-headline font-instrument">
              <span className="landing-line">You name the job.</span>
              <span className="landing-line">We lock the price.</span>
            </h1>
            <button
              type="button"
              className="btn-close-smart-deals btn-close-smart-deals-lg"
              onClick={goPortal}
            >
              Close Smart Deals
              <span aria-hidden>→</span>
            </button>
          </section>

          <section
            id="demo"
            className="landing-video-section"
            aria-label="Product demo"
          >
            <div className="landing-video-frame glass-liquid">
              <div className="landing-video-blank">
                <span className="landing-video-label">Demo video</span>
                <span className="landing-video-hint">Coming soon</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
