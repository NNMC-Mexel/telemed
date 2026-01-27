/**
 * Medical-document controller с ownership-фильтрацией.
 * - Patient видит только свои документы
 * - Doctor видит документы своих пациентов
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::medical-document.medical-document', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isAdmin) {
      const isDoctor = user.role?.type === 'doctor' || user.userRole === 'doctor';

      if (isDoctor) {
        ctx.query = {
          ...ctx.query,
          filters: {
            ...(ctx.query.filters as any || {}),
            doctor: { users_permissions_user: { id: user.id } },
          },
        };
      } else {
        ctx.query = {
          ...ctx.query,
          filters: {
            ...(ctx.query.filters as any || {}),
            user: { id: user.id },
          },
        };
      }
    }

    return await super.find(ctx);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isAdmin) {
      ctx.request.body = {
        ...ctx.request.body as any,
        data: {
          ...((ctx.request.body as any)?.data || {}),
          user: user.id,
        },
      };
    }

    return await super.create(ctx);
  },
}));
