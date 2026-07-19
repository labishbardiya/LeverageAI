/**
 * Live local business search via OpenStreetMap Overpass (no API key).
 * Real-time by lat/lng — not a hardcoded Charlotte dump.
 */

import type { PlaceDetails } from "./details";

const UA = "LeverageAI/1.0 (hackathon; contact: leverageai)";

function tagsForVertical(vertical: string): string[] {
  if (vertical === "movers") {
    return [
      'nwr["shop"="storage_rental"]',
      'nwr["office"="moving_company"]',
      'nwr["craft"="mover"]',
      'nwr["name"~"Moving|Movers|Relocation",i]',
    ];
  }
  if (vertical === "medical-imaging") {
    return [
      'nwr["healthcare"="radiology"]',
      'nwr["amenity"="clinic"]["healthcare"]',
      'nwr["name"~"MRI|Imaging|Radiology",i]',
    ];
  }
  if (vertical === "auto-repair") {
    return [
      'nwr["shop"="car_repair"]',
      'nwr["craft"="car_repair"]',
      'nwr["amenity"="car_repair"]',
    ];
  }
  // HVAC / default
  return [
    'nwr["craft"="hvac"]',
    'nwr["shop"="hvac"]',
    'nwr["craft"="plumber"]',
    'nwr["name"~"HVAC|Heating|Air Conditioning|Cooling",i]',
  ];
}

export async function searchOverpassNear(
  vertical: string,
  lat: number,
  lng: number,
  radiusM = 12000
): Promise<PlaceDetails[]> {
  const filters = tagsForVertical(vertical)
    .map((f) => `${f}(around:${radiusM},${lat},${lng});`)
    .join("\n");
  const query = `
[out:json][timeout:25];
(
  ${filters}
);
out center 20;
`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
    },
    body: `data=${encodeURIComponent(query)}`,
  });
  if (!res.ok) {
    console.warn("[overpass] http", res.status);
    return [];
  }
  const data = (await res.json()) as {
    elements?: Array<{
      id: number;
      type: string;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }>;
  };

  const seen = new Set<string>();
  const out: PlaceDetails[] = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    const name = tags.name || tags.brand || tags.operator;
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const plat = el.lat ?? el.center?.lat;
    const plng = el.lon ?? el.center?.lon;
    const phone = tags.phone || tags["contact:phone"];
    const website = tags.website || tags["contact:website"];
    const street = [tags["addr:housenumber"], tags["addr:street"]]
      .filter(Boolean)
      .join(" ");
    const addr = [street, tags["addr:city"], tags["addr:postcode"]]
      .filter(Boolean)
      .join(", ");
    out.push({
      place_id: `osm-${el.type}-${el.id}`,
      displayName: name,
      nationalPhoneNumber: phone,
      formattedAddress: addr || undefined,
      websiteUri: website,
      googleMapsUri:
        plat != null && plng != null
          ? `https://www.openstreetmap.org/?mlat=${plat}&mlon=${plng}#map=16/${plat}/${plng}`
          : undefined,
      location:
        plat != null && plng != null ? { lat: plat, lng: plng } : undefined,
      businessStatus: "OPERATIONAL",
      reviews: [],
      fetched_at: new Date().toISOString(),
      source: "OpenStreetMap Overpass (live)",
    });
    if (out.length >= 12) break;
  }
  return out;
}
