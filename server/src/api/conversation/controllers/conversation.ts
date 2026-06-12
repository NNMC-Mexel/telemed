/**
 * Conversation controller с ownership-фильтрацией.
 * Пользователь видит только свои conversations.
 * Support-чаты (type=support) дополнительно видят менеджеры и админы.
 */
import { factories } from '@strapi/strapi';
import { emitToConversation, emitToSupportStaff } from '../../../utils/realtime';

const isAdminUser = (user: any) => user?.role?.type === 'admin' || user?.userRole === 'admin';
const isManagerUser = (user: any) => user?.role?.type === 'manager' || user?.userRole === 'manager';
const isStaffUser = (user: any) => isAdminUser(user) || isManagerUser(user);

const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved'];

export default factories.createCoreController('api::conversation.conversation', ({ strapi }) => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = isAdminUser(user);
    const isManager = isManagerUser(user);
    const query = ctx.query as any;
    const requestedSort = query.sort || 'updatedAt:desc';
    const requestedFilters = query.filters || {};

    let filters: any;
    if (isAdmin) {
      filters = requestedFilters;
    } else if (isManager) {
      // Менеджер видит все support-чаты + свои собственные беседы
      filters = {
        ...requestedFilters,
        $or: [{ type: 'support' }, { users_permissions_users: { id: user.id } }],
      };
    } else {
      filters = {
        ...requestedFilters,
        users_permissions_users: { id: user.id },
      };
    }

    const conversations = await strapi.documents('api::conversation.conversation').findMany({
      filters,
      sort: requestedSort,
      status: 'published',
      populate: {
        users_permissions_users: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] },
        appointment: { fields: ['id', 'documentId', 'dateTime', 'type'] },
      },
    });

    // Для инбокса поддержки считаем непрочитанные сообщения от пациентов
    const wantsSupport =
      requestedFilters?.type === 'support' || requestedFilters?.type?.$eq === 'support';
    if (wantsSupport && isStaffUser(user)) {
      for (const conv of conversations as any[]) {
        try {
          conv.unreadCount = await strapi.db.query('api::message.message').count({
            where: {
              conversation: { id: conv.id },
              isRead: false,
              sender: { userRole: { $notIn: ['admin', 'manager'] } },
            },
          });
        } catch (e) {
          conv.unreadCount = 0;
        }
      }
    }

    return {
      data: conversations,
      meta: {
        pagination: {
          page: 1,
          pageSize: conversations.length,
          pageCount: 1,
          total: conversations.length,
        },
      },
    };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = isAdminUser(user);
    const { id } = ctx.params;

    const conversation = await strapi.documents('api::conversation.conversation').findOne({
      documentId: id,
      status: 'published',
      populate: {
        users_permissions_users: { fields: ['id', 'fullName', 'userRole'] },
        messages: { populate: ['sender'] },
      },
    });

    if (!conversation) return ctx.notFound('Conversation not found');

    const isSupportStaff = isManagerUser(user) && (conversation as any).type === 'support';
    if (!isAdmin && !isSupportStaff) {
      const members: any[] = (conversation as any).users_permissions_users || [];
      const isMember = members.some((m) => m.id === user.id);
      if (!isMember) return ctx.forbidden('Access denied');
    }

    return { data: conversation };
  },

  /**
   * POST /conversations/support
   * Get-or-create: единственный «вечный» support-тред текущего пользователя.
   */
  async support(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    if (isStaffUser(user)) {
      return ctx.badRequest('Staff users respond to support chats, they do not own one');
    }

    const populate = {
      users_permissions_users: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] },
    } as any;

    const existing = await strapi.documents('api::conversation.conversation').findMany({
      filters: { type: 'support', users_permissions_users: { id: user.id } },
      status: 'published',
      populate,
      limit: 1,
    });

    if (existing.length > 0) {
      return { data: existing[0] };
    }

    const created = await strapi.documents('api::conversation.conversation').create({
      data: { type: 'support', supportStatus: 'open' } as any,
      status: 'published',
    });

    await strapi.query('plugin::users-permissions.user').update({
      where: { id: user.id },
      data: { conversations: { connect: [created.id] } } as any,
    });

    const populated = await strapi.documents('api::conversation.conversation').findOne({
      documentId: created.documentId,
      status: 'published',
      populate,
    });

    return { data: populated || created };
  },

  /**
   * PUT /conversations/:id/support-status
   * Смена статуса обращения. Только менеджер/админ.
   */
  async setSupportStatus(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');
    if (!isStaffUser(user)) return ctx.forbidden('Access denied');

    const { id } = ctx.params;
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const supportStatus = body.supportStatus;

    if (!SUPPORT_STATUSES.includes(supportStatus)) {
      return ctx.badRequest(`supportStatus must be one of: ${SUPPORT_STATUSES.join(', ')}`);
    }

    const conversation = await strapi.documents('api::conversation.conversation').findOne({
      documentId: id,
      status: 'published',
      fields: ['id', 'documentId', 'type'],
    });

    if (!conversation) return ctx.notFound('Conversation not found');
    if ((conversation as any).type !== 'support') {
      return ctx.badRequest('Status can only be set on support conversations');
    }

    // Обновляем обе версии записи (draft + published), у них общий documentId
    await strapi.db.query('api::conversation.conversation').updateMany({
      where: { documentId: id },
      data: { supportStatus },
    });

    emitToConversation(id, 'conversation:status', { conversation: id, supportStatus });
    emitToSupportStaff('support:inbox', { conversation: id, supportStatus });

    const updated = await strapi.documents('api::conversation.conversation').findOne({
      documentId: id,
      status: 'published',
      populate: {
        users_permissions_users: { fields: ['id', 'fullName', 'userRole'] },
      },
    });

    return { data: updated };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = isAdminUser(user);
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const participantIds = body.users_permissions_users || body.participants || [];
    const appointmentRef = body.appointment;

    // Support-треды создаются только через POST /conversations/support
    if (!isAdmin) {
      delete body.type;
      delete body.supportStatus;
    }

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
