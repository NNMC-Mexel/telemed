/**
 * Public read route for the landing news block.
 *
 * Declared with `auth: false` rather than relying on the Public role, so the
 * block keeps working on a fresh deploy without anyone configuring
 * users-permissions by hand — and so the only thing ever exposed is the
 * curated projection in `publicList`.
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/news-posts/public/list',
      handler: 'news-post.publicList',
      info: { apiName: 'news-post', type: 'content-api' },
      // Two segments after /news-posts on purpose: a single segment such as
      // /news-posts/public is swallowed by the core /news-posts/:id route
      // before this handler can run.
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/news-posts/public/by-slug/:slug',
      handler: 'news-post.publicBySlug',
      info: { apiName: 'news-post', type: 'content-api' },
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
