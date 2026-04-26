import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readFile } from 'node:fs/promises';
import { logger } from '../../utils/logger.js';

let s3Client: S3Client | null = null;

/**
 * Lazily constructs and returns the shared S3-compatible client.
 *
 * Reads credentials/endpoint from environment variables on first use so
 * the module can be imported in environments (tests, CLI tools) that do
 * not configure storage. Throws a descriptive error when used without
 * configuration.
 */
function getClient(): S3Client {
  if (s3Client) return s3Client;

  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

  if (!accessKeyId || !secretAccessKey || !endpoint || !region) {
    throw new Error(
      'S3 configuration is incomplete. Expected S3_ACCESS_KEY, S3_SECRET_KEY, S3_ENDPOINT, and S3_REGION to be set.',
    );
  }

  s3Client = new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3Client;
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is not set');
  }
  return bucket;
}

/**
 * Optional per-upload metadata. Stored as S3 user-defined metadata
 * (the SDK serializes these to `x-amz-meta-*` headers). Keys must
 * match S3's user-metadata constraints (lowercase ASCII, hyphens),
 * which is why we use kebab-case names like `user-id`.
 */
export interface UploadMetadata {
  userId?: string;
  sessionId?: string;
  /** ISO-8601 timestamp; defaults to "now" if userId/sessionId are set. */
  generatedAt?: string;
}

/**
 * Uploads a local file to the configured S3-compatible bucket.
 *
 * Sets `Cache-Control: public, max-age=31536000, immutable` because
 * generated session audio is keyed by an immutable session id.
 *
 * When `metadata` is provided, attaches `x-amz-meta-user-id`,
 * `x-amz-meta-session-id`, and `x-amz-meta-generated-at` so the
 * object is self-describing for ops/audits and lifecycle tooling.
 *
 * @returns The object key (not a URL) so callers can persist it and
 *   later mint presigned URLs via {@link getStreamUrl}.
 */
export async function uploadFile(
  localPath: string,
  key: string,
  contentType = 'audio/mpeg',
  metadata?: UploadMetadata,
): Promise<string> {
  const body = await readFile(localPath);

  let s3Metadata: Record<string, string> | undefined;
  if (metadata) {
    s3Metadata = {};
    if (metadata.userId) s3Metadata['user-id'] = metadata.userId;
    if (metadata.sessionId) s3Metadata['session-id'] = metadata.sessionId;
    s3Metadata['generated-at'] = metadata.generatedAt ?? new Date().toISOString();
  }

  await getClient().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: s3Metadata,
    }),
  );
  logger.info({ key, sizeBytes: body.length }, 'Uploaded to S3 bucket');
  return key;
}

/**
 * Generates a presigned `GET` URL for streaming an S3 object.
 *
 * @param ttlSec - URL lifetime in seconds. Defaults to one hour.
 */
export async function getStreamUrl(key: string, ttlSec = 3600): Promise<string> {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: getBucket(), Key: key }),
    { expiresIn: ttlSec },
  );
}

/** Permanently deletes an object from the bucket. */
export async function deleteFile(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: getBucket(), Key: key }),
  );
  logger.info({ key }, 'Deleted from S3 bucket');
}

/**
 * Builds the canonical S3 key for a session's final mixed audio file.
 *
 * Pure function with no I/O — safe to call without storage credentials
 * configured. Format: `audio/{userId}/{sessionId}.mp3`.
 */
export function buildSessionKey(userId: string, sessionId: string): string {
  return `audio/${userId}/${sessionId}.mp3`;
}

/**
 * Test-only hook that resets the cached S3 client so subsequent calls
 * re-read environment variables. Not part of the public API.
 *
 * @internal
 */
export function _resetClientForTests(): void {
  s3Client = null;
}
