export default ({ env }) => {
  const isProduction =
    process.env.NODE_ENV === 'production' || env('NODE_ENV') === 'production';

  // Локально Strapi работает на 1340, в продакшене за прокси по пути /servers
  const localPort = 1340;

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', localPort),
    app: {
      keys: env.array('APP_KEYS'),
    },
    url: env(
      'SERVER_URL',
      isProduction
        ? 'https://medconnectserver.nnmc.kz'
        : `http://localhost:${localPort}`
    ),
  };
};
