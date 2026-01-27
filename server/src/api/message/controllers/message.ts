/**
 * Message controller с ownership-фильтрацией.
 * Пользователь видит только сообщения из своих conversations.
 * При создании — автоматически sender = текущий user.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::message.message', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isAdmin) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...(ctx.query.filters as any || {}),
          conversation: { users_permissions_users: { id: user.id } },
        },
      };
    }

    return await super.find(ctx);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    // Принудительно устанавливаем sender = текущий user
    ctx.request.body = {
      ...ctx.request.body as any,
      data: {
        ...((ctx.request.body as any)?.data || {}),
        sender: user.id,
      },
    };

    return await super.create(ctx);
  },
}));
