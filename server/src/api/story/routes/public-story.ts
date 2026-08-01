/**
 * Public read route for the landing story reel.
 *
 * `auth: false` rather than relying on the Public role, so the reel keeps
 * working on a fresh deploy without configuring users-permissions by hand.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/stories/public/list',
      handler: 'story.publicList',
      info: { apiName: 'story', type: 'content-api' },
      // Two segments after /stories on purpose: a single segment is swallowed
      // by the core /stories/:id route before this handler can run.
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
