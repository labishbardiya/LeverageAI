"use client";

import { useEffect, useState } from "react";
import type { VerticalConfig } from "@/lib/ui/types";
import { vendorDisplayName } from "@/lib/ui/types";

type ScoreComponent = {
  key: string;
  weight: number;
  value: number;
  points: number;
};

type Provider = {
  place_id?: string;
  displayName: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  formattedAddress?: string;
  openNow?: boolean;
  websiteUri?: string;
  googleMapsUri?: string;
  reviews?: { text: string; author: string }[];
  provider_score?: number;
  score_breakdown?: ScoreComponent[];
};

type Props = {
  vertical: VerticalConfig;
  zip: string;
  onContinue: () => void;
  busy?: boolean;
};

export function DiscoveryPanel({ vertical, zip, onContinue, busy }: Props) {
  const [places, setPlaces] = useState<Provider[]>([]);
  const [top3, setTop3] = useState<Provider[]>([]);
  const [caption, setCaption] = useState("");
  const [source, setSource] = useState("");
  const [attribution, setAttribution] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vertical: vertical.id, zip }),
        });
        const data = (await res.json()) as {
          places?: Provider[];
          top3?: Provider[];
          caption?: string;
          source?: string;
          attribution?: string;
        };
        if (cancelled) return;
        setPlaces(data.places || []);
        setTop3(data.top3 || (data.places || []).slice(0, 3));
        setCaption(data.caption || "");
        setSource(data.source || "");
        setAttribution(data.attribution || "");
      } catch {
        if (!cancelled) setPlaces([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vertical.id, zip]);

  const personas = vertical.vendors.slice(0, 3);

  return (
    <div className="glass-inner space-y-3.5 p-3.5">
      <div>
        <p className="label-section !text-[var(--glass-text-muted)]">Market discovery</p>
        <h3 className="mt-0.5 text-base font-medium text-[var(--glass-text)]">
          Local market · ZIP {zip}
        </h3>
        <p className="mt-1 text-xs text-[var(--glass-text-secondary)]">
          {source || "Loading…"}
        </p>
        {attribution && (
          <p className="mt-1 text-[10px] text-[var(--glass-text-muted)]">
            {attribution}
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--glass-text-muted)]">Finding providers…</p>
      ) : (
        <>
          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3">
            <p className="text-xs font-medium text-[var(--glass-text)]">
              Agents will call these 3
            </p>
            <ul className="mt-2 space-y-3">
              {top3.map((p, i) => (
                <li
                  key={p.place_id || i}
                  className="rounded-xl border border-white/12 bg-white/[0.06] p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--glass-text)]">
                        #{i + 1} {p.displayName}
                      </p>
                      <p className="text-[11px] text-[var(--glass-text-muted)]">
                        {p.rating != null ? `★ ${p.rating}` : "—"}
                        {p.userRatingCount != null
                          ? ` · ${p.userRatingCount} reviews`
                          : ""}
                        {p.openNow != null
                          ? p.openNow
                            ? " · Open now"
                            : " · Closed"
                          : ""}
                      </p>
                      {p.formattedAddress && (
                        <p className="text-[11px] text-[var(--glass-text-muted)]">
                          {p.formattedAddress}
                        </p>
                      )}
                      <p className="text-[11px] text-[var(--glass-text-secondary)]">
                        {p.nationalPhoneNumber || "phone redacted / unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold tabular-nums text-white">
                        {p.provider_score != null
                          ? Math.round(p.provider_score)
                          : "—"}
                      </p>
                      <p className="text-[10px] text-[var(--glass-text-muted)]">
                        score
                      </p>
                    </div>
                  </div>
                  {p.score_breakdown && (
                    <div className="mt-2 space-y-1">
                      {p.score_breakdown
                        .filter((c) => c.weight > 0)
                        .map((c) => (
                          <div key={c.key} className="flex items-center gap-2">
                            <span className="w-4 text-[10px] font-medium text-[var(--glass-text-muted)]">
                              {c.key}
                            </span>
                            <div className="h-1.5 flex-1 rounded-full bg-white/15">
                              <div
                                className="h-1.5 rounded-full bg-white/75"
                                style={{
                                  width: `${Math.min(100, c.value * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="w-8 text-right text-[10px] tabular-nums text-[var(--glass-text-muted)]">
                              {Math.round(c.points)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {p.websiteUri && (
                      <a
                        href={p.websiteUri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/85 underline-offset-2 hover:underline"
                      >
                        Website
                      </a>
                    )}
                    {p.googleMapsUri && (
                      <a
                        href={p.googleMapsUri}
                        target="_blank"
                        rel="noreferrer"
                        className="text-white/85 underline-offset-2 hover:underline"
                      >
                        View on Google Maps
                      </a>
                    )}
                  </div>
                  {p.reviews && p.reviews.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-white/10 pt-2">
                      {p.reviews.slice(0, 2).map((r, ri) => (
                        <li
                          key={ri}
                          className="text-[11px] text-[var(--glass-text-secondary)]"
                        >
                          “{r.text.slice(0, 120)}
                          {r.text.length > 120 ? "…" : ""}” — {r.author}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <details className="text-xs text-[var(--glass-text-muted)]">
            <summary className="cursor-pointer font-medium text-[var(--glass-text-secondary)]">
              All {places.length} providers
            </summary>
            <ul className="mt-2 max-h-32 space-y-1 overflow-auto">
              {places.map((p, i) => (
                <li key={i}>
                  {p.displayName}
                  {p.provider_score != null
                    ? ` · ${Math.round(p.provider_score)}`
                    : ""}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}

      <div className="rounded-xl border border-white/12 bg-white/[0.05] p-3">
        <p className="text-xs font-medium text-[var(--glass-text)]">
          Negotiation styles
        </p>
        <ul className="mt-1 space-y-1 text-xs text-[var(--glass-text-secondary)]">
          {personas.map((v) => (
            <li key={v.id}>
              <span className="font-medium text-[var(--glass-text)]">
                {vendorDisplayName(v)}
              </span>
              {" — "}
              {v.role_label || v.persona || v.id}
            </li>
          ))}
        </ul>
        {caption && (
          <p className="mt-2 text-[11px] leading-snug text-[var(--glass-text-muted)]">
            {caption}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={busy || loading}
        onClick={onContinue}
        className="btn-pill btn-pill-primary w-full py-2.5 disabled:opacity-50"
      >
        {busy ? "Starting agents…" : "Start negotiations"}
      </button>
      <p className="text-center text-[10px] text-[var(--glass-text-muted)]">
        Live multi-agent run — chats stream as they land.
      </p>
    </div>
  );
}
