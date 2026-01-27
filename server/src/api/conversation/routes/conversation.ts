/**
 * Conversation routes с policies.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::conversation.conversation', {
  config: {
    findOne: {
      policies: ['global::is-conversation-member'],
    },
    update: {
      policies: ['global::is-conversation-member'],
    },
    delete: {
      policies: ['global::is-admin'],
    },
  },
});
