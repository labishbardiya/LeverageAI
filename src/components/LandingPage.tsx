"use client";

import Link from "next/link";

/**
 * Landing — Instrument Serif headline, plain LEVERAGE wordmark,
 * cloud video sky, minimal CTA (no button chrome).
 */
export function LandingPage() {
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

        <header className="landing-header landing-header-merge">
          <span className="logo-leverage logo-plain" aria-label="LEVERAGE">
            LEVERAGE
          </span>
          <Link href="/livee" className="link-cta">
            Close Smart Deals →
          </Link>
        </header>

        <main className="landing-main">
          <section className="landing-hero">
            <h1 className="landing-headline font-instrument">
              <span className="landing-line">You name the job.</span>
              <span className="landing-line">We lock the price.</span>
            </h1>
            <p className="landing-sub landing-sub-plain">
              One job. Three shops. One clear pick.
            </p>
            <Link href="/livee" className="link-cta link-cta-lg">
              Close Smart Deals →
            </Link>
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
