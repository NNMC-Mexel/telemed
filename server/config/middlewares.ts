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
        // HSTS: tell browsers to always use HTTPS for 2 years
        hsts: isProduction
          ? { maxAge: 63072000, includeSubDomains: true, preload: true }
          : false,
      },
    },
    {
      name: 'strapi::cors',
      config: {
        enabled: true,
        // Explicit allowed headers — never use '*'
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
        maxAge: 7200,
        origin: isProduction
          ? [
              'https://medconnect.nnmc.kz',
              'https://www.medconnect.nnmc.kz',
              // Removed: medconnectserver.nnmc.kz (that's the API itself, not a valid origin)
            ]
          : [
              'http://localhost:5173',
              'http://localhost:3000',
              'http://localhost:1342',
              'http://localhost:1343',
            ],
      },
    },
    { name: 'global::rate-limit', config: {} },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};
