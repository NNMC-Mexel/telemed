export default ({ env }) => ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['userRole', 'fullName', 'phone', 'iin', 'doctorData'],
      },
    },
  },

  // Upload provider: 'aws-s3' for MinIO or default local storage
  // To enable MinIO: set MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET, MINIO_PUBLIC_URL
  ...(env('MINIO_ENDPOINT') ? {
    upload: {
      config: {
        provider: 'aws-s3',
        providerOptions: {
          baseUrl: env('MINIO_PUBLIC_URL'),
          s3Options: {
            credentials: {
              accessKeyId: env('MINIO_ACCESS_KEY'),
              secretAccessKey: env('MINIO_SECRET_KEY'),
            },
            region: 'us-east-1',
            endpoint: env('MINIO_ENDPOINT'),
            forcePathStyle: true,
            params: { Bucket: env('MINIO_BUCKET') },
          },
        },
        actionOptions: { upload: {}, uploadStream: {}, delete: {} },
      },
    },
  } : {}),
});
