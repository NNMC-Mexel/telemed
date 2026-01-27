/**
 * Time-slot controller.
 * При создании доктором — автоматически привязывает doctor профиль.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::time-slot.time-slot', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const isDoctor = user.role?.type === 'doctor' || user.userRole === 'doctor';

    if (!isDoctor && !isAdmin) {
      return ctx.forbidden('Only doctors can create time slots');
    }

    // Если доктор — автоматически находим и привязываем его doctor-профиль
    if (isDoctor && !isAdmin) {
      const doctorProfile = await strapi.documents('api::doctor.doctor').findFirst({
        filters: { users_permissions_user: { id: user.id } },
        fields: ['id', 'documentId'],
      });

      if (!doctorProfile) {
        return ctx.badRequest('Doctor profile not found for this user');
      }

      ctx.request.body = {
        ...ctx.request.body as any,
        data: {
          ...((ctx.request.body as any)?.data || {}),
          doctor: doctorProfile.documentId,
        },
      };
    }

    return await super.create(ctx);
  },
}));
