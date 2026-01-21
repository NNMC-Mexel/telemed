export default ({ env }) => {
  const isProduction = process.env.NODE_ENV === 'production' || env('NODE_ENV') === 'production';
  
  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    {
      name: 'strapi::cors',
      config: {
        enabled: true,
        headers: '*',
        origin: isProduction
          ? [
              'https://medconnect.nnmc.kz',
              'https://www.medconnect.nnmc.kz',
            ]
          : [
              'http://localhost:5173',
              'http://localhost:3000',
              'http://localhost:1342',
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
