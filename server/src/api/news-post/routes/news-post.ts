/**
 * news-post router — admin CRUD.
 *
 * The core routes are locked to admins; anonymous visitors read the landing
 * block through the separate public route, which returns a safe projection.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::news-post.news-post' as any, {
  config: {
    find: { policies: ['global::is-admin'] },
    findOne: { policies: ['global::is-admin'] },
    create: { policies: ['global::is-admin'] },
    update: { policies: ['global::is-admin'] },
    delete: { policies: ['global::is-admin'] },
  },
});
