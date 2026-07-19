/**
 * Live local business search via OpenStreetMap Overpass (no API key).
 * Real-time by lat/lng — not a hardcoded city dump.
 */

import type { PlaceDetails } from "./details";

const UA = "LeverageAI/1.0 (hackathon; contact: leverageai)";

/** Broader amenity sets so dense US metros return results. */
function overpassBody(vertical: string, lat: number, lng: number, radiusM: number): string {
  if (vertical === "movers") {
    return `
[out:json][timeout:28];
(
  nwr["shop"="storage_rental"](around:${radiusM},${lat},${lng});
  nwr["office"="company"]["name"~"Mov",i](around:${radiusM},${lat},${lng});
  nwr["name"~"Moving|Movers|Relocation|Van Lines",i](around:${radiusM},${lat},${lng});
);
out center 25;
`;
  }
  if (vertical === "medical-imaging") {
    return `
[out:json][timeout:28];
(
  nwr["healthcare"="radiology"](around:${radiusM},${lat},${lng});
  nwr["amenity"="clinic"](around:${radiusM},${lat},${lng});
  nwr["amenity"="hospital"](around:${radiusM},${lat},${lng});
  nwr["name"~"MRI|Imaging|Radiology|Diagnostic",i](around:${radiusM},${lat},${lng});
);
out center 25;
`;
  }
  if (vertical === "auto-repair") {
    return `
[out:json][timeout:28];
(
  nwr["shop"="car_repair"](around:${radiusM},${lat},${lng});
  nwr["craft"="car_repair"](around:${radiusM},${lat},${lng});
  nwr["amenity"="car_repair"](around:${radiusM},${lat},${lng});
  nwr["shop"="car"](around:${radiusM},${lat},${lng});
);
out center 25;
`;
  }
  // HVAC — include plumbing/electrician tags often co-listed; name search is key
  return `
[out:json][timeout:28];
(
  nwr["craft"="hvac"](around:${radiusM},${lat},${lng});
  nwr["shop"="hvac"](around:${radiusM},${lat},${lng});
  nwr["craft"="plumber"](around:${radiusM},${lat},${lng});
  nwr["craft"="electrician"](around:${radiusM},${lat},${lng});
  nwr["name"~"HVAC|Heating|Air Conditioning|Cooling|Mechanical",i](around:${radiusM},${lat},${lng});
);
out center 25;
`;
}

export async function searchOverpassNear(
  vertical: string,
  lat: number,
  lng: number,
  radiusM = 25000
): Promise<PlaceDetails[]> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];
  const body = overpassBody(vertical, lat, lng, radiusM);

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": UA,
        },
        body: `data=${encodeURIComponent(body)}`,
      });
      if (!res.ok) {
        console.warn("[overpass] http", endpoint, res.status);
        continue;
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
            plat != null && plng != null
              ? { lat: plat, lng: plng }
              : undefined,
          businessStatus: "OPERATIONAL",
          reviews: [],
          fetched_at: new Date().toISOString(),
          source: "OpenStreetMap Overpass (live)",
        });
        if (out.length >= 12) break;
      }
      if (out.length > 0) return out;
    } catch (e) {
      console.warn("[overpass] fail", endpoint, e);
    }
  }
  return [];
}
