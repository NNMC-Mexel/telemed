/**
 * Doctor controller.
 * find/findOne — публичные (управляется permissions роли).
 * update — только свой профиль (policy на route).
 *   Non-admin doctors cannot modify protected fields:
 *   price, rating, reviewsCount, isActive, userId, users_permissions_user,
 *   licenseNumber, position, workplace
 */
import { factories } from '@strapi/strapi';

// Fields only admin may change
const ADMIN_ONLY_FIELDS = [
  'price',
  'rating',
  'reviewsCount',
  'isActive',
  'userId',
  'users_permissions_user',
  'licenseNumber',
  'position',
  'workplace',
];

export default factories.createCoreController('api::doctor.doctor', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    const isAdmin = user?.role?.type === 'admin' || user?.userRole === 'admin';
    const isDoctor = user?.role?.type === 'doctor' || user?.userRole === 'doctor';

    // Public/patient-facing catalog must only expose active doctors created by the clinic admin.
    // Admins need the full list; doctors need access to their own profile even if inactive.
    if (!isAdmin && !isDoctor) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...((ctx.query?.filters as any) || {}),
          isActive: { $eq: true },
        },
      };
    }

    return await super.find(ctx);
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    const user = ctx.state.user;
    const isAdmin = user?.role?.type === 'admin' || user?.userRole === 'admin';
    const isDoctor = user?.role?.type === 'doctor' || user?.userRole === 'doctor';
    const doctor = (response as any)?.data;

    if (!isAdmin && !isDoctor && doctor?.isActive === false) {
      return ctx.notFound('Doctor not found');
    }

    return response;
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    if (!isAdmin) return ctx.forbidden('Only admins can create doctors');

    return await super.create(ctx);
  },

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
