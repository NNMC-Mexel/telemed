export default ({ env }) => {
  const isProduction =
    process.env.NODE_ENV === 'production' || env('NODE_ENV') === 'production';

  // Локально Strapi работает на 1340, в продакшене на отдельном домене
  const localPort = 1340;

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', localPort),
    app: {
      keys: env.array('APP_KEYS'),
    },
    // Production: https://medconnectserver.nnmc.kz
    // Development: http://localhost:1340
    url: env(
      'SERVER_URL',
      isProduction
        ? 'https://medconnectserver.nnmc.kz'
        : `http://localhost:${localPort}`
    ),
  };
};
