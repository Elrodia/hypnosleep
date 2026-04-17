import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { logger } from '../utils/logger.js';

let s3Client: S3Client | null = null;

/**
 * Returns the S3-compatible storage client.
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION;
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

    if (!accessKeyId || !secretAccessKey || !endpoint || !region) {
      throw new Error('S3 credentials are not configured');
    }

    s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  return s3Client;
}

const getBucket = () => process.env.S3_BUCKET ?? 'hypnosleep-audio';

/**
 * Uploads an audio file to S3-compatible storage.
 * @returns The public URL of the uploaded file.
 */
export async function uploadAudio(
  key: string,
  body: Buffer,
  contentType = 'audio/mpeg',
): Promise<string> {
  const client = getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  const endpoint = process.env.S3_ENDPOINT ?? '';
  const bucket = getBucket();
  const publicUrl = `${endpoint}/${bucket}/${key}`;
  logger.info({ key, publicUrl }, 'Audio uploaded to S3');
  return publicUrl;
}

/**
 * Deletes an audio file from S3-compatible storage.
 */
export async function deleteAudio(key: string): Promise<void> {
  const client = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );

  logger.info({ key }, 'Audio deleted from S3');
}

/**
 * Gets an audio file stream from S3-compatible storage.
 */
export async function getAudio(key: string): Promise<Buffer | null> {
  const client = getS3Client();

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
    logger.error({ err, key }, 'Failed to get audio from S3');
    return null;
  }
}
