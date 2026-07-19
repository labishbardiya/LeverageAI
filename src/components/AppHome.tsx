"use client";

import { ProductWorkspace } from "./ProductWorkspace";

/**
 * Judge-facing product shell — full live product at `/`.
 * Sample golden replay: `/live` (or `/live?replay=true`).
 * Alias: `/livee` → same ProductWorkspace.
 */
export function AppHome() {
  return <ProductWorkspace />;
}
