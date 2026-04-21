/**
 * Notification controller.
 * - find: пользователь видит только свои, admin — все
 * - unreadCount: число непрочитанных у текущего пользователя
 * - markAllAsRead: помечает все непрочитанные текущего пользователя
 * - update/delete: только владелец (или admin)
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::notification.notification', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const queryFilters = (ctx.query?.filters as any) || {};
    const filters: any = { ...queryFilters };

    if (!isAdmin) {
      filters.user = { id: user.id };
    }

    const sort = (ctx.query?.sort as any) || ['createdAt:desc'];
    const limitRaw = (ctx.query?.pagination as any)?.limit;
    const limit = Math.min(Number(limitRaw) || 50, 200);

    const data = await strapi.documents('api::notification.notification').findMany({
      filters,
      sort,
      limit,
    });

    return {
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: data.length,
          pageCount: 1,
          total: data.length,
        },
      },
    };
  },

  async unreadCount(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const items = await strapi.documents('api::notification.notification').findMany({
      filters: { user: { id: user.id }, isRead: false },
      fields: ['id'],
      limit: 1000,
    });

    return { data: { count: items.length } };
  },

  async markAllAsRead(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const unread = await strapi.documents('api::notification.notification').findMany({
      filters: { user: { id: user.id }, isRead: false },
      fields: ['id'],
      limit: 1000,
    });

    for (const n of unread as any[]) {
      if (!n?.documentId) continue;
      await strapi.documents('api::notification.notification').update({
        documentId: n.documentId,
        data: { isRead: true } as any,
      });
    }

    return { data: { count: unread.length } };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const { id } = ctx.params;
    const existing = await strapi.documents('api::notification.notification').findOne({
      documentId: id,
      populate: { user: { fields: ['id'] } },
    });
    if (!existing) return ctx.notFound('Notification not found');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    if (!isAdmin && (existing as any).user?.id !== user.id) {
      return ctx.forbidden('Cannot update this notification');
    }

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const updated = await strapi.documents('api::notification.notification').update({
      documentId: id,
      data: { isRead: typeof body.isRead === 'boolean' ? body.isRead : true } as any,
    });

    return { data: updated };
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const { id } = ctx.params;
    const existing = await strapi.documents('api::notification.notification').findOne({
      documentId: id,
      populate: { user: { fields: ['id'] } },
    });
    if (!existing) return ctx.notFound('Notification not found');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    if (!isAdmin && (existing as any).user?.id !== user.id) {
      return ctx.forbidden('Cannot delete this notification');
    }

    await strapi.documents('api::notification.notification').delete({ documentId: id });
    return { data: { documentId: id } };
  },
}));
