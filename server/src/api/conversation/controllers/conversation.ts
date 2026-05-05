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

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const { id } = ctx.params;

    const conversation = await strapi.documents('api::conversation.conversation').findOne({
      documentId: id,
      populate: {
        users_permissions_users: { fields: ['id'] },
        messages: { populate: ['sender'] },
      },
    });

    if (!conversation) return ctx.notFound('Conversation not found');

    if (!isAdmin) {
      const members: any[] = (conversation as any).users_permissions_users || [];
      const isMember = members.some((m) => m.id === user.id);
      if (!isMember) return ctx.forbidden('Access denied');
    }

    return { data: conversation };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const participantIds = body.users_permissions_users || body.participants || [];
    const appointmentRef = body.appointment;

    if (!isAdmin && !appointmentRef) {
      return ctx.badRequest('Conversation can only be created for an appointment');
    }

    let appointment: any = null;
    if (appointmentRef) {
      appointment = typeof appointmentRef === 'number'
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
    }

    if (!isAdmin && !appointment) return ctx.badRequest('Appointment not found');

    let requiredParticipants: number[] = [];
    if (appointment) {
      const patientId = (appointment as any).patient?.id;
      const doctorUserId = (appointment as any).doctor?.users_permissions_user?.id;
      requiredParticipants = [patientId, doctorUserId].filter(Boolean);

      if (!isAdmin) {
        const isParticipant = user.id === patientId || user.id === doctorUserId;
        if (!isParticipant) return ctx.forbidden('Access denied');
      }
    }

    const normalizedParticipants = Array.isArray(participantIds)
      ? participantIds.map((id) => Number(id)).filter(Boolean)
      : [];

    if (!isAdmin) {
      const hasAllAppointmentMembers = requiredParticipants.every((id) => normalizedParticipants.includes(id));
      if (!hasAllAppointmentMembers || normalizedParticipants.length !== requiredParticipants.length) {
        return ctx.badRequest('Conversation participants must match appointment participants');
      }
    }

    const conversationData = { ...body };
    delete conversationData.users_permissions_users;
    delete conversationData.participants;
    if (appointment?.documentId) {
      conversationData.appointment = appointment.documentId;
    }

    const created = await strapi.documents('api::conversation.conversation').create({
      data: conversationData,
      status: 'published',
    });

    const usersToConnect = isAdmin && normalizedParticipants.length > 0
      ? normalizedParticipants
      : requiredParticipants;

    for (const participantId of usersToConnect) {
      await strapi.query('plugin::users-permissions.user').update({
        where: { id: participantId },
        data: {
          conversations: { connect: [created.id] },
        } as any,
      });
    }

    const populated = await strapi.documents('api::conversation.conversation').findOne({
      documentId: created.documentId,
      populate: { users_permissions_users: { fields: ['id', 'fullName', 'email'] } },
    });

    return { data: populated || created };
  },
}));
