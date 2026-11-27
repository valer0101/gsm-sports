import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Uploads bucket lives in Cloudflare R2 (S3-compatible). Distinct from the
 * backups bucket — uploads are forever, backups rotate. Public URLs are
 * served from a custom domain bound to the bucket so the API never
 * proxies binary traffic.
 *
 * Required env:
 *   R2_ENDPOINT          e.g. https://<account-id>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_UPLOADS_BUCKET    e.g. gsm-uploads
 *   R2_PUBLIC_BASE_URL   e.g. https://uploads.gsmarm.com (no trailing slash)
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client | null = null;
  private bucket = '';
  private publicBaseUrl = '';

  onModuleInit() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_UPLOADS_BUCKET;
    const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
      this.logger.warn(
        'R2 storage not configured (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_UPLOADS_BUCKET, R2_PUBLIC_BASE_URL). Uploads will fail until set.',
      );
      return;
    }

    // R2 requires `region: 'auto'` and path-style addressing for the
    // S3 SDK to talk to it; virtual-host style would resolve against AWS.
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
    this.bucket = bucket;
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<string> {
    if (!this.client) {
      throw new Error('R2 storage is not configured');
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // 1 year — uploaded URLs are immutable (UUID filenames), so let
        // the CDN cache hard.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }
}
