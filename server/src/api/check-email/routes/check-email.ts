export default {
  routes: [
    {
      method: 'GET',
      path: '/auth/check-email',
      handler: 'check-email.checkEmail',
      config: {
        auth: false,
        policies: [],
      },
    },
  ],
};
