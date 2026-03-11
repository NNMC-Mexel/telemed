export default ({ env }) => {
  const isProduction = process.env.NODE_ENV === 'production' || env('NODE_ENV') === 'production';
  
  return [
    'strapi::logger',
    'strapi::errors',
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:'],
            'img-src': [
              "'self'",
              'data:',
              'blob:',
              'market-assets.strapi.io',
              // MinIO public URL — allow Strapi admin to load uploaded images
              env('MINIO_PUBLIC_URL', 'http://localhost:9000'),
            ],
            'media-src': [
              "'self'",
              'data:',
              'blob:',
              env('MINIO_PUBLIC_URL', 'http://localhost:9000'),
            ],
            upgradeInsecureRequests: null,
          },
        },
      },
    },
    {
      name: 'strapi::cors',
      config: {
        enabled: true,
        headers: '*',
        // Production: medconnect.nnmc.kz (frontend)
        // Development: localhost ports
        origin: isProduction
          ? [
              'https://medconnect.nnmc.kz',
              'https://www.medconnect.nnmc.kz',
              'https://medconnectserver.nnmc.kz',
            ]
          : [
              'http://localhost:5173',
              'http://localhost:3000',
              'http://localhost:1342',
              'http://localhost:1343',
            ],
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
