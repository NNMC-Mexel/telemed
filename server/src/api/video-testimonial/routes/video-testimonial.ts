/** Admin-only CRUD; anonymous visitors use the curated public route. */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::video-testimonial.video-testimonial' as any, {
  config: {
    find: { policies: ['global::is-admin'] },
    findOne: { policies: ['global::is-admin'] },
    create: { policies: ['global::is-admin'] },
    update: { policies: ['global::is-admin'] },
    delete: { policies: ['global::is-admin'] },
  },
});
