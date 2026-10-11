import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import path from "path";

// Env vars are read lazily at call time (after dotenv.config() in server.ts).
// Validation happens eagerly in server.ts before any request is served.


// ── S3 client pointed at R2 ──────────────────────────────────────────────────
// Client is created lazily to avoid reading env vars before dotenv.config() runs.

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

// Keep a named export alias for any internal code that used r2Client directly
export const r2Client = { get send() { return getR2Client().send.bind(getR2Client()); } };


export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_PUBLIC_BASE_URL &&
    !process.env.R2_PUBLIC_BASE_URL.includes("yourdomain") &&
    !process.env.R2_PUBLIC_BASE_URL.includes("<")
  );
}

/** Generate a collision-resistant object key that is safe for S3/R2. */
export function generateObjectKey(
  identifier: string,
  originalName: string,
  folder = "products"
): string {
  const random = randomBytes(12).toString("hex");
  const ext = path.extname(originalName).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".jpg";
  // Sanitise identifier and folder to prevent path traversal
  const safeId = (identifier || "item").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  const safeFolder = (folder || "products").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return `${safeFolder}/${safeId}/${random}${ext}`;
}

/**
 * Extract the R2 object key from a full public URL.
 * Returns undefined if the URL does not belong to this bucket's public base.
 */
export function keyFromUrl(url: string): string | undefined {
  const base = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  if (!base || !url.startsWith(base + "/")) return undefined;
  return url.slice(base.length + 1);
}

/** Build a public HTTPS URL for an R2 object key. */
export function publicUrl(key: string): string {
  return `${(process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, "")}/${key}`;
}

// ── Upload ───────────────────────────────────────────────────────────────────

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Upload a buffer to R2.
 *
 * @param key       Object key (use generateObjectKey)
 * @param body      File buffer
 * @param mimeType  MIME type of the image (e.g. "image/webp")
 */
export async function uploadToR2(
  key: string,
  body: Buffer,
  mimeType: string
): Promise<UploadResult> {
  await getR2Client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: mimeType,
      // Immutable cache for uniquely-named objects
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return { key, url: publicUrl(key) };
}

// ── Delete ───────────────────────────────────────────────────────────────────

/**
 * Delete a single R2 object by key.
 * Silently ignores "not found" errors — deletion is best-effort.
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: key })
    );
  } catch (err) {
    // Log but don't propagate so callers aren't blocked
    console.error(`[R2] Failed to delete key "${key}":`, err);
  }
}

/**
 * Delete multiple R2 objects by key (up to 1000 per call).
 * Keys that don't exist are silently ignored.
 */
export async function deleteManyFromR2(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  // R2 supports up to 1000 objects per DeleteObjects call
  const chunks: string[][] = [];
  for (let i = 0; i < keys.length; i += 1000) {
    chunks.push(keys.slice(i, i + 1000));
  }

  await Promise.allSettled(
    chunks.map((chunk) =>
      getR2Client()
        .send(
          new DeleteObjectsCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Delete: {
              Objects: chunk.map((k) => ({ Key: k })),
              Quiet: true,
            },
          })
        )
        .catch((err) => console.error("[R2] Bulk delete error:", err))
    )
  );
}

/**
 * Given a list of public image URLs belonging to this bucket,
 * extract their keys and delete them all from R2.
 */
export async function deleteImagesByUrls(urls: string[]): Promise<void> {
  const keys = urls
    .map(keyFromUrl)
    .filter((k): k is string => k !== undefined);
  await deleteManyFromR2(keys);
}
