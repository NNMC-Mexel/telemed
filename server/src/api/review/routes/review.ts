/**
 * Review routes с policies.
 * find/findOne — публичные (доступны по permissions роли).
 * update/delete — только admin.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::review.review', {
  config: {
    update: {
      policies: ['global::is-admin'],
    },
    delete: {
      policies: ['global::is-admin'],
    },
  },
});
