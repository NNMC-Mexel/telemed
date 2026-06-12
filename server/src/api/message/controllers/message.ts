/**
 * Message controller с ownership-фильтрацией.
 * Пользователь видит только сообщения из своих conversations.
 * При создании — автоматически sender = текущий user.
 */
import { factories } from '@strapi/strapi';
import { emitToConversation } from '../../../utils/realtime';

const isAdminUser = (user: any) => user?.role?.type === 'admin' || user?.userRole === 'admin';
const isManagerUser = (user: any) => user?.role?.type === 'manager' || user?.userRole === 'manager';
const isStaffUser = (user: any) => isAdminUser(user) || isManagerUser(user);

export default factories.createCoreController('api::message.message', ({ strapi }) => ({
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const { id } = ctx.params;

    const message = await strapi.documents('api::message.message').findOne({
      documentId: id,
      status: 'published',
      populate: {
        conversation: {
          populate: { users_permissions_users: { fields: ['id'] } },
        },
      },
    });

    if (!message) return ctx.notFound();

    if (!isAdmin) {
      const members: any[] = message.conversation?.users_permissions_users || [];
      const isMember = members.some((m) => m.id === user.id);
      if (!isMember) return ctx.forbidden('Access denied');
    }

    return { data: message };
  },

  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (isAdmin) {
      return await super.find(ctx);
    }

    const query = ctx.query as any;
    const requestedFilters = query.filters || {};
    const { conversation: conversationFilter, ...messageFilters } = requestedFilters;

    const resolveConversation = async () => {
      if (!conversationFilter) return null;

      const numericId = conversationFilter?.id?.$eq || conversationFilter?.id || null;
      const documentId =
        conversationFilter?.documentId?.$eq ||
        conversationFilter?.documentId ||
        (typeof conversationFilter === 'string' ? conversationFilter : null);

      if (documentId) {
        return strapi.documents('api::conversation.conversation').findOne({
          documentId: String(documentId),
          status: 'published',
          fields: ['id', 'documentId', 'type'],
          populate: { users_permissions_users: { fields: ['id'] } },
        });
      }

      if (numericId) {
        return strapi.query('api::conversation.conversation').findOne({
          where: { id: Number(numericId) },
          select: ['id', 'documentId', 'type'],
          populate: { users_permissions_users: { select: ['id'] } },
        });
      }

      return null;
    };

    let conversationDocIds: string[] = [];
    const requestedConversation = await resolveConversation();

    if (conversationFilter) {
      if (!requestedConversation) {
        return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
      }

      const members: any[] = (requestedConversation as any).users_permissions_users || [];
      const isMember = members.some((m) => m.id === user.id);
      const isSupportStaff =
        isManagerUser(user) && (requestedConversation as any).type === 'support';
      if (!isMember && !isSupportStaff) return ctx.forbidden('Access denied');

      conversationDocIds = [(requestedConversation as any).documentId].filter(Boolean);
    } else {
      const conversations = await strapi.documents('api::conversation.conversation').findMany({
        filters: { users_permissions_users: { id: user.id } },
        status: 'published',
        fields: ['documentId'],
        limit: 1000,
      });
      conversationDocIds = conversations.map((c: any) => c.documentId).filter(Boolean);
    }

    if (conversationDocIds.length === 0) {
      return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
    }

    const messages = await strapi.documents('api::message.message').findMany({
      filters: {
        ...messageFilters,
        conversation: { documentId: { $in: conversationDocIds } },
      },
      sort: query.sort || 'createdAt:asc',
      status: 'published',
      populate: {
        sender: { fields: ['id', 'documentId', 'fullName', 'email', 'userRole'] },
        conversation: { fields: ['id', 'documentId'] },
        attachments: true,
      },
      limit: Number(query?.pagination?.limit || query?.pagination?.pageSize || 500),
    });

    return {
      data: messages,
      meta: {
        pagination: {
          page: 1,
          pageSize: messages.length,
          pageCount: 1,
          total: messages.length,
        },
      },
    };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const conversationRef = body.conversation;
    if (!conversationRef) return ctx.badRequest('conversation is required');

    const conversation = typeof conversationRef === 'number'
      ? await strapi.query('api::conversation.conversation').findOne({
          where: { id: conversationRef },
          select: ['id', 'documentId', 'type', 'supportStatus'],
          populate: { users_permissions_users: { select: ['id'] } },
        })
      : await strapi.documents('api::conversation.conversation').findOne({
          documentId: conversationRef,
          status: 'published',
          fields: ['id', 'documentId', 'type', 'supportStatus'],
          populate: { users_permissions_users: { fields: ['id'] } },
        });

    if (!conversation) return ctx.badRequest('Conversation not found');

    const isAdmin = isAdminUser(user);
    const isSupport = (conversation as any).type === 'support';
    const isSupportStaff = isManagerUser(user) && isSupport;
    const members: any[] = (conversation as any).users_permissions_users || [];
    const isMember = members.some((m) => m.id === user.id);
    if (!isAdmin && !isMember && !isSupportStaff) return ctx.forbidden('Access denied');

    // Принудительно устанавливаем sender = текущий user. Используем document
    // service, потому что REST validation Strapi v5 отклоняет sender, если он
    // появляется в клиентском payload.
    const messageData: Record<string, any> = {
      content: body.content,
      conversation: (conversation as any).documentId || conversationRef,
      sender: user.documentId || user.id,
    };
    if (body.attachments !== undefined) messageData.attachments = body.attachments;
    if (body.isRead !== undefined) messageData.isRead = body.isRead;
    if (body.readAt !== undefined) messageData.readAt = body.readAt;

    const created = await strapi.documents('api::message.message').create({
      data: messageData as any,
      status: 'published',
      populate: {
        sender: { fields: ['id', 'fullName', 'email', 'userRole'] },
        conversation: { fields: ['id', 'documentId'] },
      },
    });

    // Поддерживаем lastMessage/lastMessageAt на беседе (обе версии: draft + published)
    const convDocId = (conversation as any).documentId;
    try {
      const convUpdate: Record<string, any> = {
        lastMessage: String(body.content || '').slice(0, 255),
        lastMessageAt: new Date(),
      };

      // Авто-статусы support-обращения:
      // менеджер ответил на открытое → «в работе»; пациент написал в решённое → снова «открыто»
      if (isSupport) {
        const currentStatus = (conversation as any).supportStatus;
        if (isStaffUser(user) && currentStatus === 'open') {
          convUpdate.supportStatus = 'in_progress';
        } else if (!isStaffUser(user) && currentStatus === 'resolved') {
          convUpdate.supportStatus = 'open';
        }
      }

      await strapi.db.query('api::conversation.conversation').updateMany({
        where: { documentId: convDocId },
        data: convUpdate,
      });

      if (convUpdate.supportStatus) {
        emitToConversation(convDocId, 'conversation:status', {
          conversation: convDocId,
          supportStatus: convUpdate.supportStatus,
        });
      }
    } catch (error) {
      strapi.log.error('message create: failed to update conversation metadata:', error);
    }

    return { data: created };
  },

  /**
   * POST /messages/mark-read
   * Помечает прочитанными все чужие сообщения в беседе для текущего пользователя.
   */
  async markConversationRead(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const conversationRef = body.conversation;
    if (!conversationRef) return ctx.badRequest('conversation is required');

    const conversation = await strapi.documents('api::conversation.conversation').findOne({
      documentId: String(conversationRef),
      status: 'published',
      fields: ['id', 'documentId', 'type'],
      populate: { users_permissions_users: { fields: ['id'] } },
    });

    if (!conversation) return ctx.notFound('Conversation not found');

    const isSupportStaff = isStaffUser(user) && (conversation as any).type === 'support';
    const members: any[] = (conversation as any).users_permissions_users || [];
    const isMember = members.some((m) => m.id === user.id);
    if (!isAdminUser(user) && !isMember && !isSupportStaff) {
      return ctx.forbidden('Access denied');
    }

    const unread = await strapi.db.query('api::message.message').findMany({
      where: {
        conversation: { documentId: (conversation as any).documentId },
        isRead: false,
        sender: { id: { $ne: user.id } },
      },
      select: ['id', 'documentId'],
    });

    if (unread.length > 0) {
      const docIds = [...new Set(unread.map((m: any) => m.documentId).filter(Boolean))];
      await strapi.db.query('api::message.message').updateMany({
        where: { documentId: { $in: docIds } },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return { data: { marked: unread.length } };
  },
}));
