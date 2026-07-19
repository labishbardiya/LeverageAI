import { redirect } from "next/navigation";

/**
 * Legacy demo path — judges should use /live for the golden sample.
 * Preserves query string (vertical, replay, etc.).
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") q.set(k, v);
    else if (Array.isArray(v) && v[0]) q.set(k, v[0]);
  }
  if (!q.has("replay")) q.set("replay", "true");
  redirect(`/live?${q.toString()}`);
}
