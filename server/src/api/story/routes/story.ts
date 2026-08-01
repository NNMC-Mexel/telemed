/**
 * story router — admin CRUD.
 *
 * Anonymous visitors read the reel through the separate public route, which
 * returns a safe projection.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::story.story' as any, {
  config: {
    find: { policies: ['global::is-admin'] },
    findOne: { policies: ['global::is-admin'] },
    create: { policies: ['global::is-admin'] },
    update: { policies: ['global::is-admin'] },
    delete: { policies: ['global::is-admin'] },
  },
});
