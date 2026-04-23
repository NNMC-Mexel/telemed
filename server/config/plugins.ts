export default ({ env }) => ({
  'users-permissions': {
    config: {
      register: {
        allowedFields: ['userRole', 'fullName', 'phone', 'iin', 'doctorData'],
      },
      // URL фронтенда для сброса пароля (Strapi подставит ?code=XXX)
      resetPasswordURL: env('FRONTEND_URL', 'http://localhost:5173') + '/reset-password',
    },
  },

  // Email provider (Yandex SMTP via nodemailer)
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'smtp.yandex.ru'),
        port: env.int('SMTP_PORT', 465),
        secure: true,
        auth: {
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        },
      },
      settings: {
        defaultFrom: `MedConnect <${env('SMTP_FROM', 'dev-renys@yandex.kz')}>`,
        defaultReplyTo: env('SMTP_FROM', 'dev-renys@yandex.kz'),
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
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
          sign: { expiresIn: 3600 },
        },
      },
    },
  } : {}),
});
