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
      // Only admin can update conversation metadata (add/remove participants etc.)
      // Members interact via messages, not by mutating the conversation itself
      policies: ['global::is-admin'],
    },
    delete: {
      policies: ['global::is-admin'],
    },
  },
});
