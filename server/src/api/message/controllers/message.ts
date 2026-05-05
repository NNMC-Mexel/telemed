/**
 * Message controller с ownership-фильтрацией.
 * Пользователь видит только сообщения из своих conversations.
 * При создании — автоматически sender = текущий user.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::message.message', ({ strapi }) => ({
  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const { id } = ctx.params;

    const message = await strapi.documents('api::message.message').findOne({
      documentId: id,
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

    if (!isAdmin) {
      ctx.query = {
        ...ctx.query,
        filters: {
          ...(ctx.query.filters as any || {}),
          conversation: { users_permissions_users: { id: user.id } },
        },
      };
    }

    return await super.find(ctx);
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
          populate: { users_permissions_users: { select: ['id'] } },
        })
      : await strapi.documents('api::conversation.conversation').findOne({
          documentId: conversationRef,
          status: 'published',
          populate: { users_permissions_users: { fields: ['id'] } },
        });

    if (!conversation) return ctx.badRequest('Conversation not found');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const members: any[] = (conversation as any).users_permissions_users || [];
    const isMember = members.some((m) => m.id === user.id);
    if (!isAdmin && !isMember) return ctx.forbidden('Access denied');

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
        sender: { fields: ['id', 'fullName', 'email'] },
        conversation: { fields: ['id', 'documentId'] },
      },
    });

    return { data: created };
  },
}));
