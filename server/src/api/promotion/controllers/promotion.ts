/**
 * Promotion controller.
 * Admins manage promotions. Public price display is exposed through doctor responses.
 */
import { factories } from '@strapi/strapi';

const isAdminUser = (user: any) => user?.role?.type === 'admin' || user?.userRole === 'admin';

const getBody = (ctx: any) => (ctx.request.body as any)?.data || ctx.request.body || {};

const validatePromotionPayload = (ctx: any, body: any) => {
  if (body.discountType === 'percentage') {
    const value = Number(body.discountValue);
    if (!Number.isFinite(value) || value < 1 || value > 99) {
      return ctx.badRequest('Percentage discount must be between 1 and 99');
    }
  }

  if (body.startsAt && body.endsAt) {
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (!Number.isNaN(startsAt.getTime()) && !Number.isNaN(endsAt.getTime()) && startsAt >= endsAt) {
      return ctx.badRequest('Promotion end date must be after start date');
    }
  }

  return null;
};

export default factories.createCoreController('api::promotion.promotion' as any, ({ strapi }) => ({
  async find(ctx) {
    if (!isAdminUser(ctx.state.user)) return ctx.forbidden('Only admins can view promotions');
    return await super.find(ctx);
  },

  async findOne(ctx) {
    if (!isAdminUser(ctx.state.user)) return ctx.forbidden('Only admins can view promotions');
    return await super.findOne(ctx);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!isAdminUser(user)) return ctx.forbidden('Only admins can create promotions');

    const validation = validatePromotionPayload(ctx, getBody(ctx));
    if (validation) return validation;

    const response = await super.create(ctx);
    strapi.log.info(JSON.stringify({
      audit: 'PROMOTION_CREATED',
      promotionId: (response as any)?.data?.documentId || (response as any)?.data?.id,
      createdBy: user.id,
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));
    return response;
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!isAdminUser(user)) return ctx.forbidden('Only admins can update promotions');

    const existing = await strapi.documents('api::promotion.promotion' as any).findOne({
      documentId: ctx.params.id,
    });
    const validation = validatePromotionPayload(ctx, { ...(existing || {}), ...getBody(ctx) });
    if (validation) return validation;

    const response = await super.update(ctx);
    strapi.log.info(JSON.stringify({
      audit: 'PROMOTION_UPDATED',
      promotionId: ctx.params.id,
      changedBy: user.id,
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));
    return response;
  },

  async delete(ctx) {
    const user = ctx.state.user;
    if (!isAdminUser(user)) return ctx.forbidden('Only admins can delete promotions');
    return await super.delete(ctx);
  },
}));
