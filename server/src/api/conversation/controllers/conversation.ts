/**
 * Conversation controller с ownership-фильтрацией.
 * Пользователь видит только свои conversations.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::conversation.conversation', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isAdmin) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...(ctx.query.filters as any || {}),
          users_permissions_users: { id: user.id },
        },
      };
    }

    return await super.find(ctx);
  },
}));
