/**
 * Consent-record controller с ownership-фильтрацией.
 * - Patient видит только свои записи согласий
 * - Admin видит всё
 * - Создание разрешено только в процессе регистрации (через strapi-server.ts),
 *   поэтому публичный create заблокирован для non-admin.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::consent-record.consent-record', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    const data = await strapi.documents('api::consent-record.consent-record').findMany({
      filters: isAdmin ? {} : { user: { id: user.id } },
      sort: ['createdAt:desc'],
    });

    return {
      data,
      meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
    };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const { id } = ctx.params;

    const record = await strapi.documents('api::consent-record.consent-record').findOne({
      documentId: id,
      populate: { user: { fields: ['id'] } },
    });

    if (!record) return ctx.notFound('Consent record not found');

    if (!isAdmin && (record as any).user?.id !== user.id) {
      return ctx.forbidden('Access denied');
    }

    return { data: record };
  },

  async create(ctx) {
    const user = ctx.state.user;
    const isApiToken = (ctx.state as any)?.auth?.strategy?.name === 'api-token';

    if (!isApiToken && (!user || !(user.role?.type === 'admin' || user.userRole === 'admin'))) {
      return ctx.forbidden('Consent records are created automatically during registration');
    }

    return super.create(ctx);
  },

  async update(ctx) {
    return ctx.forbidden('Consent records are immutable');
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    if (!isAdmin) return ctx.forbidden('Only admins can delete consent records');

    return super.delete(ctx);
  },
}));
