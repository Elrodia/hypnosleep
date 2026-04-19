/**
 * Back-compat shim for the legacy R2/S3 helper.
 *
 * The canonical S3-compatible storage helpers live in
 * `modules/audio/audio.s3.ts`. This module used to contain a parallel
 * implementation; it now re-exports the canonical helpers so older
 * imports keep working without duplicating code.
 *
 * New code should import from `modules/audio/audio.s3.js` directly.
 */
import {
  uploadFile,
  deleteFile as deleteFileFromBucket,
  getStreamUrl,
  buildSessionKey,
} from '../modules/audio/audio.s3.js';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

export { buildSessionKey, getStreamUrl };

/**
 * Legacy uploader that accepts an in-memory buffer.
 *
 * The canonical uploader streams a local file (so FFmpeg output doesn't
 * have to be re-read into memory). We preserve the buffer signature here
 * for any caller that still hands us a `Buffer`, writing to a temp file
 * and delegating to the canonical uploader.
 *
 * @returns A URL-ish string of the form `${S3_ENDPOINT}/${bucket}/${key}`,
 *   matching the previous behaviour. Note that the canonical code path
 *   persists the S3 *key* (not a URL) and mints presigned URLs on
 *   demand via {@link getStreamUrl}.
 */
export async function uploadAudio(
  key: string,
  body: Buffer,
  _contentType = 'audio/mpeg',
): Promise<string> {
  const tmpPath = join(tmpdir(), `r2-upload-${randomUUID()}.mp3`);
  try {
    await writeFile(tmpPath, body);
    await uploadFile(tmpPath, key);
    const endpoint = process.env.S3_ENDPOINT ?? '';
    const bucket = process.env.S3_BUCKET ?? '';
    const publicUrl = `${endpoint}/${bucket}/${key}`;
    logger.info({ key, publicUrl }, 'Audio uploaded via legacy r2.service');
    return publicUrl;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}

/** Deletes an audio object from the bucket. */
export async function deleteAudio(key: string): Promise<void> {
  return deleteFileFromBucket(key);
}
