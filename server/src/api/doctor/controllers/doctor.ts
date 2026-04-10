/**
 * Doctor controller.
 * find/findOne — публичные (управляется permissions роли).
 * update — только свой профиль (policy на route).
 *   Non-admin doctors cannot modify protected fields:
 *   price, rating, reviewsCount, isActive, userId, users_permissions_user
 */
import { factories } from '@strapi/strapi';

// Fields only admin may change
const ADMIN_ONLY_FIELDS = ['price', 'rating', 'reviewsCount', 'isActive', 'userId', 'users_permissions_user'];

export default factories.createCoreController('api::doctor.doctor', ({ strapi }) => ({
  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isAdmin) {
      const rawBody = ctx.request.body as any;
      const body = rawBody?.data && typeof rawBody.data === 'object' ? rawBody.data : rawBody || {};
      const filtered = { ...body };
      ADMIN_ONLY_FIELDS.forEach((f) => delete filtered[f]);
      if (rawBody?.data && typeof rawBody.data === 'object') {
        (ctx.request.body as any) = { ...rawBody, data: filtered };
      } else {
        ctx.request.body = filtered;
      }
    }

    // Audit log for price changes (admin only path)
    if (isAdmin) {
      const body = (ctx.request.body as any)?.data || ctx.request.body || {};
      if ('price' in body) {
        strapi.log.info(JSON.stringify({
          audit: 'DOCTOR_PRICE_CHANGED',
          doctorId: ctx.params.id,
          newPrice: body.price,
          changedBy: user.id,
          ip: ctx.request.ip,
          ts: new Date().toISOString(),
        }));
      }
    }

    return await super.update(ctx);
  },
}));
