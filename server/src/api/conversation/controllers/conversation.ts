/**
 * Conversation controller с ownership-фильтрацией.
 * Пользователь видит только свои conversations.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::conversation.conversation', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isAdmin) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...(ctx.query.filters as any || {}),
          users_permissions_users: { id: user.id },
        },
      };
    }

    return await super.find(ctx);
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const participantIds = body.users_permissions_users || body.participants || [];
    const appointmentRef = body.appointment;

    if (isAdmin) {
      return await super.create(ctx);
    }

    if (!appointmentRef) {
      return ctx.badRequest('Conversation can only be created for an appointment');
    }

    const appointment = typeof appointmentRef === 'number'
      ? await strapi.query('api::appointment.appointment').findOne({
          where: { id: appointmentRef },
          populate: {
            patient: { select: ['id'] },
            doctor: { populate: { users_permissions_user: { select: ['id'] } } },
          },
        })
      : await strapi.documents('api::appointment.appointment').findOne({
          documentId: appointmentRef,
          populate: {
            patient: { fields: ['id'] },
            doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
          },
        });

    if (!appointment) return ctx.badRequest('Appointment not found');

    const patientId = (appointment as any).patient?.id;
    const doctorUserId = (appointment as any).doctor?.users_permissions_user?.id;
    const isParticipant = user.id === patientId || user.id === doctorUserId;
    if (!isParticipant) return ctx.forbidden('Access denied');

    const normalizedParticipants = Array.isArray(participantIds)
      ? participantIds.map((id) => Number(id)).filter(Boolean)
      : [];
    const requiredParticipants = [patientId, doctorUserId].filter(Boolean);
    const hasAllAppointmentMembers = requiredParticipants.every((id) => normalizedParticipants.includes(id));
    if (!hasAllAppointmentMembers || normalizedParticipants.length !== requiredParticipants.length) {
      return ctx.badRequest('Conversation participants must match appointment participants');
    }

    return await super.create(ctx);
  },
}));
