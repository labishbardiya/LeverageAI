/**
 * Free geocoding via OpenStreetMap Nominatim (no API key).
 * Used to turn city / ZIP / free-text location into lat/lng for live discovery.
 */

export type GeoPoint = {
  lat: number;
  lng: number;
  display_name: string;
  zip?: string;
  city?: string;
};

const UA = "LeverageAI/1.0 (hackathon; contact: leverageai)";

/** Extract US ZIP or city-ish location tokens from free text. */
export function extractLocationHints(text: string): {
  zip?: string;
  cityQuery?: string;
  raw: string;
} {
  const t = text.trim();
  const zip = t.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1];
  // "in Charlotte", "near Rock Hill NC", "Austin, TX"
  const near = t.match(
    /\b(?:in|near|around|at)\s+([A-Za-z][A-Za-z .'-]{1,40}?)(?:\s*,?\s*([A-Z]{2}))?(?:\s|$|,|\.|zip)/i
  );
  let cityQuery: string | undefined;
  if (near) {
    cityQuery = [near[1]?.trim(), near[2]?.trim()].filter(Boolean).join(", ");
  } else {
    const cityState = t.match(
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,\s*([A-Z]{2})\b/
    );
    if (cityState) cityQuery = `${cityState[1]}, ${cityState[2]}`;
  }
  return { zip, cityQuery, raw: t };
}

export async function geocodeLocation(
  query: string
): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(3_500),
  } as RequestInit).catch(() => null);
  if (!res?.ok) return null;
  const rows = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    address?: {
      postcode?: string;
      city?: string;
      town?: string;
      village?: string;
    };
  }>;
  const r = rows[0];
  if (!r) return null;
  const lat = Number(r.lat);
  const lng = Number(r.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    display_name: r.display_name,
    zip: r.address?.postcode?.slice(0, 5),
    city:
      r.address?.city || r.address?.town || r.address?.village || undefined,
  };
}

export async function resolveGeoFromJobText(
  text: string,
  zipHint?: string
): Promise<GeoPoint | null> {
  const hints = extractLocationHints(text);
  const zip = zipHint || hints.zip;
  if (zip) {
    const g = await geocodeLocation(`${zip}, USA`);
    if (g) return { ...g, zip: g.zip || zip };
  }
  if (hints.cityQuery) {
    const g = await geocodeLocation(`${hints.cityQuery}, USA`);
    if (g) return g;
  }
  // Last resort: full text (often fails — ok)
  if (text.length > 8 && text.length < 120) {
    return geocodeLocation(text);
  }
  return null;
}
