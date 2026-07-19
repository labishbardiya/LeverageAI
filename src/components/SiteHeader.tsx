"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type Props = {
  /** Show Close Smart Deals on the right (home only). */
  showCta?: boolean;
  /** When true, LEVERAGE links home (live portal). */
  logoAsHomeLink?: boolean;
};

/**
 * Shared top bar — identical LEVERAGE placement on home + live.
 * Logo sits in a fixed slot so width never shifts between pages.
 */
export function SiteHeader({ showCta = false, logoAsHomeLink = false }: Props) {
  const router = useRouter();

  const logoInner = (
    <span className="logo-leverage logo-plain" aria-label="LEVERAGE">
      LEVERAGE
    </span>
  );

  return (
    <header className="site-header sticky top-0 z-30">
      <div className="site-header-inner">
        {/* Fixed-width logo slot — same box home (no link) and live (link) */}
        <div className="site-logo-slot">
          {logoAsHomeLink ? (
            <Link href="/" className="site-logo-link no-underline">
              {logoInner}
            </Link>
          ) : (
            <span className="site-logo-link">{logoInner}</span>
          )}
        </div>
        {/* Spacer so LEVERAGE stays left-aligned even without CTA */}
        <div className="site-header-right">
          {showCta ? (
            <button
              type="button"
              className="btn-liquid-glass"
              onClick={() => router.push("/livee")}
            >
              Close Smart Deals
              <span aria-hidden>→</span>
            </button>
          ) : (
            <span className="site-header-right-placeholder" aria-hidden />
          )}
        </div>
      </div>
    </header>
  );
}
