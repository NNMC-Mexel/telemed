export default {
  routes: [
    {
      method: 'GET',
      path: '/file-proxy/:key',
      handler: 'file-proxy.proxy',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
