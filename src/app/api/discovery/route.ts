import { NextRequest, NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const schema = z.object({
  vertical: z.string().default("hvac"),
  zip: z.string().min(3).max(12),
});

type Place = {
  displayName: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  formattedAddress?: string;
};

function maskPhone(phone?: string): string | undefined {
  if (!phone) return phone;
  return phone.replace(/(\d{2})\d{2}$/, "$1••");
}

function loadFallback(vertical: string, zip: string): Place[] | null {
  const candidates = [
    join(process.cwd(), "data", "discovery", `${vertical}-${zip}.json`),
    join(
      process.cwd(),
      "data",
      "discovery",
      vertical === "movers" ? "movers-29730.json" : "hvac-28202.json"
    ),
  ];
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    try {
      const data = JSON.parse(readFileSync(p, "utf8")) as {
        places?: Place[];
        source?: string;
        note?: string;
      };
      return (data.places ?? []).map((pl) => ({
        ...pl,
        nationalPhoneNumber: maskPhone(pl.nationalPhoneNumber),
      }));
    } catch {
      /* next */
    }
  }
  return null;
}

/**
 * POST /api/discovery
 * Google Places Text Search when GOOGLE_PLACES_API_KEY is set;
 * else offline snapshot from data/discovery/*.json
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
    const { vertical, zip } = parsed.data;
    const textQuery =
      vertical === "movers"
        ? `moving company near ${zip}`
        : `HVAC contractor near ${zip}`;

    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (key) {
      const res = await fetch(
        "https://places.googleapis.com/v1/places:searchText",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "places.displayName,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.formattedAddress",
          },
          body: JSON.stringify({ textQuery }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          places?: Array<{
            displayName?: { text?: string } | string;
            rating?: number;
            userRatingCount?: number;
            nationalPhoneNumber?: string;
            formattedAddress?: string;
          }>;
        };
        const places: Place[] = (data.places ?? []).map((p) => {
          const name =
            typeof p.displayName === "string"
              ? p.displayName
              : p.displayName?.text || "Unknown";
          return {
            displayName: name,
            rating: p.rating,
            userRatingCount: p.userRatingCount,
            nationalPhoneNumber: maskPhone(p.nationalPhoneNumber),
            formattedAddress: p.formattedAddress,
          };
        });
        return NextResponse.json({
          vertical,
          zip,
          query: textQuery,
          source: "Google Places API (live)",
          places,
          caption:
            "In production these are the numbers we dial via ElevenLabs' native Twilio integration; today, three negotiation-style counter-agents stand in.",
        });
      }
    }

    const places = loadFallback(vertical, zip) ?? [];
    return NextResponse.json({
      vertical,
      zip,
      query: textQuery,
      source: "offline snapshot (data/discovery)",
      places,
      caption:
        "In production these are the numbers we dial via ElevenLabs' native Twilio integration; today, three negotiation-style counter-agents stand in.",
    });
  } catch (e) {
    console.error("[POST /api/discovery]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Discovery failed" },
      { status: 500 }
    );
  }
}
