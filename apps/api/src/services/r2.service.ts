import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { logger } from '../utils/logger.js';

let s3Client: S3Client | null = null;

/**
 * Returns the S3-compatible Cloudflare R2 client.
 */
function getR2Client(): S3Client {
  if (!s3Client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 credentials are not configured');
    }

    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return s3Client;
}

const getBucket = () => process.env.R2_BUCKET_NAME ?? 'hypnosleep-audio';
const getPublicUrl = () => process.env.R2_PUBLIC_URL ?? '';

/**
 * Uploads an audio file to Cloudflare R2.
 * @returns The public URL of the uploaded file.
 */
export async function uploadAudio(
  key: string,
  body: Buffer,
  contentType = 'audio/mpeg',
): Promise<string> {
  const client = getR2Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  const publicUrl = `${getPublicUrl()}/${key}`;
  logger.info({ key, publicUrl }, 'Audio uploaded to R2');
  return publicUrl;
}

/**
 * Deletes an audio file from Cloudflare R2.
 */
export async function deleteAudio(key: string): Promise<void> {
  const client = getR2Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );

  logger.info({ key }, 'Audio deleted from R2');
}

/**
 * Gets an audio file stream from Cloudflare R2.
 */
export async function getAudio(key: string): Promise<Buffer | null> {
  const client = getR2Client();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      }),
    );

    if (!response.Body) return null;

    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    logger.error({ err, key }, 'Failed to get audio from R2');
    return null;
  }
}
