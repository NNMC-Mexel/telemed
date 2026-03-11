export default ({ env }) => ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['userRole', 'fullName', 'phone', 'iin', 'doctorData'],
      },
    },
  },

  // File uploads → MinIO (S3-compatible)
  upload: {
    config: {
      provider: 'aws-s3',
      providerOptions: {
        baseUrl: env('MINIO_PUBLIC_URL'),   // Public URL of the bucket (for frontend)
        s3Options: {
          credentials: {
            accessKeyId: env('MINIO_ACCESS_KEY'),
            secretAccessKey: env('MINIO_SECRET_KEY'),
          },
          region: 'us-east-1',              // MinIO ignores region, but field is required
          endpoint: env('MINIO_ENDPOINT'),  // MinIO S3 API URL
          forcePathStyle: true,             // Required for MinIO (not AWS virtual-hosted)
          params: {
            Bucket: env('MINIO_BUCKET'),
          },
        },
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});
