/**
 * Message routes с policies.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::message.message', {
  config: {
    update: {
      policies: ['global::is-admin'],
    },
    delete: {
      policies: ['global::is-admin'],
    },
  },
});
