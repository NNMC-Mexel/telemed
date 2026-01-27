/**
 * Review controller.
 * При создании — принудительно patient = текущий user.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::review.review', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isAdmin) {
      ctx.request.body = {
        ...ctx.request.body as any,
        data: {
          ...((ctx.request.body as any)?.data || {}),
          patient: user.id,
        },
      };
    }

    return await super.create(ctx);
  },
}));
