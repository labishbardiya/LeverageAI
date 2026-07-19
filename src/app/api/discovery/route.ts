import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  enrichFromSnapshotPlace,
  fetchPlaceDetails,
  type PlaceDetails,
} from "@/lib/places/details";
import {
  computeProviderScore,
  type PlaceLike,
} from "@/lib/ranking/providerScore";
import {
  extractLocationHints,
  geocodeLocation,
  resolveGeoFromJobText,
} from "@/lib/places/geocode";
import { searchOverpassNear } from "@/lib/places/overpass";

const schema = z.object({
  vertical: z.string().default("hvac"),
  /** Preferred: free-text job or location string from the user */
  location: z.string().optional(),
  query_text: z.string().optional(),
  /** Optional ZIP if already extracted */
  zip: z.string().min(3).max(12).optional(),
});

function queryFor(vertical: string, where: string): string {
  if (vertical === "movers") return `moving company near ${where}`;
  if (vertical === "medical-imaging")
    return `MRI imaging center near ${where}`;
  if (vertical === "auto-repair") return `auto repair shop near ${where}`;
  return `HVAC contractor near ${where}`;
}

/** Last-resort offline file — only if live network paths all fail */
function loadSnapshotFallback(vertical: string): PlaceDetails[] {
  const name =
    vertical === "movers"
      ? "movers-29730.json"
      : vertical === "medical-imaging"
        ? "medical-imaging-28202.json"
        : vertical === "auto-repair"
          ? "auto-repair-28202.json"
          : "hvac-28202.json";
  const p = join(process.cwd(), "data", "discovery", name);
  if (!existsSync(p)) return [];
  try {
    const data = JSON.parse(readFileSync(p, "utf8")) as {
      places?: Record<string, unknown>[];
    };
    return (data.places || []).map((pl, i) => enrichFromSnapshotPlace(pl, i));
  } catch {
    return [];
  }
}

async function searchGooglePlaces(
  textQuery: string
): Promise<PlaceDetails[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) return [];
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.formattedAddress,places.location,places.googleMapsUri",
      },
      body: JSON.stringify({ textQuery }),
    }
  );
  if (!res.ok) {
    console.warn("[discovery] Places searchText", res.status);
    return [];
  }
  const data = (await res.json()) as {
    places?: Array<Record<string, unknown>>;
  };
  const list: PlaceDetails[] = [];
  for (const p of data.places || []) {
    const id = typeof p.id === "string" ? p.id : null;
    if (!id) continue;
    const detailed = await fetchPlaceDetails(id);
    if (detailed) {
      list.push(detailed);
      continue;
    }
    const loc = p.location as
      | { latitude?: number; longitude?: number }
      | undefined;
    list.push(
      enrichFromSnapshotPlace(
        {
          displayName:
            typeof p.displayName === "object" && p.displayName
              ? (p.displayName as { text?: string }).text
              : p.displayName,
          rating: p.rating,
          userRatingCount: p.userRatingCount,
          nationalPhoneNumber: p.nationalPhoneNumber,
          formattedAddress: p.formattedAddress,
          place_id: id,
          googleMapsUri: p.googleMapsUri,
          location: loc
            ? { lat: loc.latitude, lng: loc.longitude }
            : undefined,
        },
        list.length
      )
    );
  }
  return list;
}

/**
 * POST /api/discovery
 * Live discovery from user location text / ZIP.
 * 1) Google Places (New) when GOOGLE_PLACES_API_KEY set
 * 2) else OpenStreetMap Overpass near geocoded lat/lng (real-time, free)
 * 3) offline snapshot only if network fails
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }
    const { vertical } = parsed.data;
    const freeText = [
      parsed.data.query_text,
      parsed.data.location,
      parsed.data.zip,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!freeText) {
      return NextResponse.json(
        {
          error:
            "Tell us where the job is (city or ZIP) so we can find real local shops.",
          code: "LOCATION_REQUIRED",
        },
        { status: 400 }
      );
    }

    const hints = extractLocationHints(freeText);
    const geo =
      (await resolveGeoFromJobText(freeText, parsed.data.zip || hints.zip)) ||
      (hints.cityQuery ? await geocodeLocation(hints.cityQuery) : null) ||
      (parsed.data.zip
        ? await geocodeLocation(`${parsed.data.zip}, USA`)
        : null);

    const whereLabel =
      geo?.display_name ||
      parsed.data.zip ||
      hints.zip ||
      hints.cityQuery ||
      freeText.slice(0, 80);
    const textQuery = queryFor(vertical, whereLabel);

    let detailsList: PlaceDetails[] = [];
    let source = "";

    // 1) Google Places when configured
    detailsList = await searchGooglePlaces(textQuery);
    if (detailsList.length > 0) {
      source = "Google Places API (New) — live searchText + Place Details";
    }

    // 2) Live OSM Overpass near geocoded point
    if (detailsList.length === 0 && geo) {
      detailsList = await searchOverpassNear(vertical, geo.lat, geo.lng);
      if (detailsList.length > 0) {
        source = "OpenStreetMap Overpass — live near your location";
      }
    }

    // 3) Soft fallback only if live paths failed
    if (detailsList.length === 0) {
      detailsList = loadSnapshotFallback(vertical);
      source =
        "Offline snapshot (live search unavailable — set GOOGLE_PLACES_API_KEY or check network)";
    }

    const ranked = detailsList
      .map((d) => {
        const place: PlaceLike = {
          place_id: d.place_id,
          rating: d.rating,
          userRatingCount: d.userRatingCount,
          businessStatus: d.businessStatus,
          nationalPhoneNumber: d.nationalPhoneNumber,
          websiteUri: d.websiteUri,
          newestReviewAt: d.fetched_at,
        };
        const score = computeProviderScore(place, { postCall: false });
        return { provider: d, score };
      })
      .sort((a, b) => b.score.total - a.score.total);

    const top3 = ranked.slice(0, 3);
    const resolvedZip =
      geo?.zip || hints.zip || parsed.data.zip || undefined;

    return NextResponse.json({
      vertical,
      zip: resolvedZip,
      location: whereLabel,
      geo: geo
        ? { lat: geo.lat, lng: geo.lng, display_name: geo.display_name }
        : null,
      query: textQuery,
      source,
      attribution:
        source.includes("Google")
          ? "Place data © Google. Ratings and reviews from Google."
          : "Map data © OpenStreetMap contributors.",
      places: ranked.map((r) => ({
        ...r.provider,
        provider_score: r.score.total,
        score_breakdown: r.score.components,
      })),
      top3: top3.map((r) => ({
        ...r.provider,
        provider_score: r.score.total,
        score_breakdown: r.score.components,
      })),
      caption:
        "Top local providers ranked for this job location — fetched live from your query.",
      live: !source.includes("Offline"),
    });
  } catch (e) {
    console.error("[POST /api/discovery]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Discovery failed" },
      { status: 500 }
    );
  }
}
