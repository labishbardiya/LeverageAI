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
  location?: { lat?: number; lng?: number };
};

type Props = {
  vertical: string;
  zip?: string;
  location?: string;
  geo?: { lat: number; lng: number } | null;
};

/**
 * Top-3 shops map — live discovery by user location text.
 * OSM embed centered on geocoded job location when available.
 */
export function Top3Map({ vertical, zip, location, geo }: Props) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState("");
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    geo || null,
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vertical,
            zip: zip || undefined,
            location: location || zip || undefined,
            query_text: location || zip || undefined,
          }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          if (!cancelled) {
            setErr(
              (e as { error?: string }).error ||
                "Could not load local shops for this location.",
            );
          }
          return;
        }
        const data = (await res.json()) as {
          top3?: Place[];
          places?: Place[];
          query?: string;
          geo?: { lat: number; lng: number } | null;
          location?: string;
        };
        if (cancelled) return;
        setPlaces((data.top3 || data.places || []).slice(0, 3));
        setQuery(data.query || data.location || location || zip || "");
        if (data.geo?.lat != null) {
          setCenter({ lat: data.geo.lat, lng: data.geo.lng });
        } else {
          const withLoc = (data.top3 || data.places || []).find(
            (p) => p.location?.lat != null,
          );
          if (withLoc?.location?.lat != null && withLoc.location.lng != null) {
            setCenter({
              lat: withLoc.location.lat,
              lng: withLoc.location.lng,
            });
          }
        }
        setErr(null);
      } catch {
        if (!cancelled) setErr("Discovery network error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vertical, zip, location]);

  if (err && !places.length) {
    return (
      <p className="mt-4 text-center text-[12px] text-[var(--ink-muted)]">
        {err}
      </p>
    );
  }
  if (!places.length) return null;

  const c = center || { lat: 39.5, lng: -98.35 };
  const d = 0.08;
  const bbox = `${c.lng - d}%2C${c.lat - d}%2C${c.lng + d}%2C${c.lat + d}`;
  const osmSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${c.lat}%2C${c.lng}`;

  return (
    <section className="stage-enter mt-5">
      <p className="label-section mb-2 text-center">Top 3 nearby</p>
      <div className="glass-liquid overflow-hidden p-2 sm:p-3">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="map-frame overflow-hidden rounded-2xl border border-white/50 bg-white/40">
            <iframe
              title="Area map"
              src={osmSrc}
              className="h-[200px] w-full border-0 sm:h-[260px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <p className="px-2 py-1.5 text-center text-[10px] text-[var(--ink-muted)]">
              Map · {query || "your location"} · live
            </p>
          </div>
          <ol className="flex flex-col gap-2">
            {places.map((p, i) => {
              const name = p.displayName || p.name || `Shop ${i + 1}`;
              const addr = p.formattedAddress || p.address || "";
              const maps =
                p.googleMapsUri ||
                `https://www.openstreetmap.org/search?query=${encodeURIComponent(
                  `${name} ${addr}`,
                )}`;
              return (
                <li
                  key={`${name}-${i}`}
                  className="glass-inner flex items-start gap-3 p-3 text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-[12px] font-semibold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{name}</p>
                    {addr && (
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-muted)]">
                        {addr}
                      </p>
                    )}
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
