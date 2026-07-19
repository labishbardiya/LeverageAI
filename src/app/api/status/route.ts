import { NextResponse } from "next/server";
import { isLiveModeEnabled, liveModeStatus } from "@/lib/elevenlabs/liveMode";
import { hasDatabaseUrl } from "@/lib/db/pool";

/** GET /api/status — health for judges UI */
export async function GET() {
  return NextResponse.json({
    ok: true,
    live_mode: isLiveModeEnabled(),
    database: hasDatabaseUrl(),
    places: true,
    discovery_provider: "openstreetmap",
    osm: {
      nominatim: Boolean(
        process.env.OSM_NOMINATIM_URL?.trim() ||
          "https://nominatim.openstreetmap.org",
      ),
      overpass: Boolean(
        process.env.OSM_OVERPASS_URL?.trim() ||
          "https://overpass-api.de/api/interpreter",
      ),
      qlever: Boolean(
        process.env.OSM_QLEVER_URL?.trim() ||
          "https://qlever.dev/api/osm-planet",
      ),
    },
    details: liveModeStatus(),
  });
}
