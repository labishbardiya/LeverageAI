export type BlobStorageMode = "oidc" | "read-write-token" | null;
type BlobAuthEnv = Record<string, string | undefined>;

/**
 * Vercel Blob supports short-lived deployment OIDC credentials (preferred)
 * and the legacy long-lived read/write token. Never expose either value.
 */
export function blobStorageMode(
  env: BlobAuthEnv = process.env,
): BlobStorageMode {
  if (env.VERCEL_OIDC_TOKEN?.trim() && env.BLOB_STORE_ID?.trim()) {
    return "oidc";
  }
  if (env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return "read-write-token";
  }
  return null;
}

export function hasDurableBlobStorage(
  env: BlobAuthEnv = process.env,
): boolean {
  return blobStorageMode(env) !== null;
}
