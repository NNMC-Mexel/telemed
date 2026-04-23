import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const getS3Client = () =>
  new S3Client({
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    region: 'us-east-1',
    endpoint: process.env.MINIO_ENDPOINT,
    forcePathStyle: true,
  });

export default {
  async proxy(ctx) {
    const { key } = ctx.params;

    if (!process.env.MINIO_ENDPOINT) {
      ctx.status = 404;
      ctx.body = { error: 'Storage not configured' };
      return;
    }

    try {
      const s3 = getS3Client();
      const command = new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: key,
      });

      const response = await s3.send(command);

      ctx.set('Content-Type', response.ContentType || 'application/octet-stream');
      if (response.ContentLength) {
        ctx.set('Content-Length', String(response.ContentLength));
      }
      ctx.set('Cache-Control', 'public, max-age=86400');

      ctx.body = response.Body as any;
    } catch {
      ctx.status = 404;
      ctx.body = { error: 'File not found' };
    }
  },
};
