/** Anonymous, consent-filtered landing feed. */

export default {
  routes: [
    {
      method: 'GET',
      path: '/video-testimonials/public/list',
      handler: 'video-testimonial.publicList',
      info: { apiName: 'video-testimonial', type: 'content-api' },
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
