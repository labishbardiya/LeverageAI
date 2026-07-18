"use client";

import { useEffect, useState } from "react";
import type { VerticalConfig } from "@/lib/ui/types";
import { vendorDisplayName } from "@/lib/ui/types";

type Place = {
  displayName: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  formattedAddress?: string;
};

type Props = {
  vertical: VerticalConfig;
  zip: string;
  onContinue: () => void;
  busy?: boolean;
};

export function DiscoveryPanel({ vertical, zip, onContinue, busy }: Props) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [caption, setCaption] = useState("");
  const [source, setSource] = useState("");
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
          places?: Place[];
          caption?: string;
          source?: string;
        };
        if (cancelled) return;
        setPlaces(data.places || []);
        setCaption(data.caption || "");
        setSource(data.source || "");
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
        Market discovery
      </p>
      <h3 className="text-base font-semibold text-slate-900">
        Real market for ZIP {zip}
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        {source || "Loading call list…"}
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-slate-400">Finding contractors…</p>
      ) : (
        <ul className="mt-3 max-h-40 space-y-2 overflow-auto">
          {places.map((p, i) => (
            <li
              key={i}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5 text-sm"
            >
              <div>
                <p className="font-medium text-slate-800">{p.displayName}</p>
                <p className="text-[11px] text-slate-500">
                  {p.rating != null ? `★ ${p.rating}` : "—"}
                  {p.userRatingCount != null
                    ? ` · ${p.userRatingCount} reviews`
                    : ""}
                  {p.nationalPhoneNumber
                    ? ` · ${p.nationalPhoneNumber}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
          {places.length === 0 && (
            <li className="text-sm text-slate-400">No places returned</li>
          )}
        </ul>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700">
          Mapped negotiation styles (today)
        </p>
        <ul className="mt-1 space-y-1 text-xs text-slate-600">
          {personas.map((v) => (
            <li key={v.id}>
              <span className="font-medium">{vendorDisplayName(v)}</span>
              {" — "}
              {v.role_label || v.persona || v.id}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          {caption ||
            "In production these are the numbers we dial via ElevenLabs' native Twilio integration; today, three negotiation-style counter-agents stand in."}
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onContinue}
        className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        Start negotiations
      </button>
    </div>
  );
}
