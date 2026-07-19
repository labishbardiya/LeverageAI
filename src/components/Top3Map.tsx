"use client";

import { useEffect, useState } from "react";

type Place = {
  displayName?: string;
  name?: string;
  formattedAddress?: string;
  address?: string;
  rating?: number;
  provider_score?: number;
  googleMapsUri?: string;
  lat?: number;
  lng?: number;
  location?: { latitude?: number; longitude?: number };
};

type Props = {
  vertical: string;
  zip: string;
};

/**
 * Top-3 shops map strip under chats.
 * Free OSM embed — no Google Maps key required (Places key still optional for live list).
 */
export function Top3Map({ vertical, zip }: Props) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vertical, zip }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          top3?: Place[];
          places?: Place[];
          query?: string;
        };
        if (cancelled) return;
        setPlaces((data.top3 || data.places || []).slice(0, 3));
        setQuery(data.query || `${vertical} near ${zip}`);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vertical, zip]);

  if (!places.length) return null;

  // Charlotte / Rock Hill defaults when snapshots lack lat/lng
  const center =
    zip.startsWith("297")
      ? { lat: 34.9249, lng: -81.0251 }
      : { lat: 35.2271, lng: -80.8431 };
  const d = 0.06;
  const bbox = `${center.lng - d}%2C${center.lat - d}%2C${center.lng + d}%2C${center.lat + d}`;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;

  return (
    <section className="stage-enter mt-5">
      <p className="label-section mb-2 text-center">Top 3 nearby</p>
      <div className="glass-liquid overflow-hidden p-2 sm:p-3">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="map-frame overflow-hidden rounded-2xl border border-white/50 bg-white/40">
            <iframe
              title="Area map"
              src={osmSrc}
              className="h-[220px] w-full border-0 sm:h-[260px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <p className="px-2 py-1.5 text-center text-[10px] text-[var(--ink-muted)]">
              Map · {query || zip} · OpenStreetMap
            </p>
          </div>
          <ol className="flex flex-col gap-2">
            {places.map((p, i) => {
              const name = p.displayName || p.name || `Shop ${i + 1}`;
              const addr =
                p.formattedAddress || p.address || `Near ZIP ${zip}`;
              const maps =
                p.googleMapsUri ||
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${name} ${addr}`
                )}`;
              return (
                <li
                  key={`${name}-${i}`}
                  className="glass-inner flex items-start gap-3 p-3 text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-[12px] font-semibold text-[var(--ink)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{name}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-muted)]">
                      {addr}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-[var(--ink-secondary)]">
                      {typeof p.rating === "number" && (
                        <span>★ {p.rating.toFixed(1)}</span>
                      )}
                      {typeof p.provider_score === "number" && (
                        <span>Score {Math.round(p.provider_score)}</span>
                      )}
                      <a
                        href={maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        Open map
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
