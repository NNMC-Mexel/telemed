/**
 * Notification controller.
 * - find: пользователь видит только свои, admin — все
 * - unreadCount: число непрочитанных у текущего пользователя
 * - markAllAsRead: помечает все непрочитанные текущего пользователя
 * - update/delete: только владелец (или admin)
 */
import { factories } from '@strapi/strapi';

const PUSH_PLATFORMS = ['ios', 'android', 'web'];
const MAX_PUSH_TOKENS_PER_USER = 20;

const normalizePushTokens = (value: any) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object' && typeof item.token === 'string')
    .map((item) => ({
      token: String(item.token),
      platform: PUSH_PLATFORMS.includes(String(item.platform)) ? String(item.platform) : 'web',
      deviceId: item.deviceId ? String(item.deviceId).slice(0, 128) : null,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      enabled: item.enabled !== false,
    }));
};

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

  async registerPushToken(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const token = String(body.token || '').trim();
    const platform = String(body.platform || '').trim();
    const deviceId = body.deviceId ? String(body.deviceId).trim().slice(0, 128) : null;

    if (!token || token.length < 20 || token.length > 4096) {
      return ctx.badRequest('Invalid push token');
    }
    if (!PUSH_PLATFORMS.includes(platform)) {
      return ctx.badRequest('Invalid platform');
    }

    const userRecord = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      select: ['id', 'pushTokens'],
    });
    if (!userRecord) return ctx.notFound('User not found');

    const now = new Date().toISOString();
    const tokens = normalizePushTokens((userRecord as any).pushTokens)
      .filter((item) => item.token !== token);
    tokens.unshift({
      token,
      platform,
      deviceId,
      createdAt: now,
      updatedAt: now,
      enabled: true,
    });

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { pushTokens: tokens.slice(0, MAX_PUSH_TOKENS_PER_USER) },
    });

    return { data: { registered: true } };
  },

  async unregisterPushToken(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const token = String(body.token || '').trim();
    if (!token) return ctx.badRequest('token is required');

    const userRecord = await strapi.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      select: ['id', 'pushTokens'],
    });
    if (!userRecord) return ctx.notFound('User not found');

    const tokens = normalizePushTokens((userRecord as any).pushTokens)
      .filter((item) => item.token !== token);

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { pushTokens: tokens },
    });

    return { data: { unregistered: true } };
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
