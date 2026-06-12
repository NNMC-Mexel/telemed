/**
 * Message lifecycle hooks.
 * afterCreate:
 *  - обычная беседа: уведомление всем участникам, кроме отправителя;
 *  - support-чат: пациент написал → уведомляем всех менеджеров/админов,
 *    менеджер ответил → уведомляем пациента (участников беседы).
 * Также рассылает realtime-события подписчикам беседы и staff-инбоксу.
 */
import { emitToConversation, emitToSupportStaff } from '../../../../utils/realtime';

export default {
  async afterCreate(event) {
    const { result } = event;
    const documentId = result?.documentId;
    if (!documentId) return;
    // afterCreate срабатывает дважды (draft + published) — уведомляем один раз
    if (!result?.publishedAt) return;

    try {
      const msg = await strapi.documents('api::message.message').findOne({
        documentId: String(documentId),
        populate: {
          sender: { fields: ['id', 'fullName', 'userRole'] },
          conversation: { fields: ['id', 'documentId', 'type'] },
          attachments: true,
        },
      });

      const senderId = (msg as any)?.sender?.id;
      const senderName = (msg as any)?.sender?.fullName || 'Собеседник';
      const senderRole = (msg as any)?.sender?.userRole;
      const conversationDocId = (msg as any)?.conversation?.documentId;
      const isSupport = (msg as any)?.conversation?.type === 'support';
      if (!conversationDocId) return;

      // Realtime: подписчикам беседы — само сообщение, staff-инбоксу — сигнал обновиться
      emitToConversation(conversationDocId, 'message:new', {
        id: (result as any).id,
        documentId,
        content: (result as any).content,
        createdAt: (result as any).createdAt,
        isRead: false,
        conversation: conversationDocId,
        sender: (msg as any)?.sender
          ? {
              id: (msg as any).sender.id,
              fullName: (msg as any).sender.fullName,
              userRole: (msg as any).sender.userRole,
            }
          : null,
        attachments: (msg as any)?.attachments || [],
      });
      if (isSupport) {
        emitToSupportStaff('support:inbox', { conversation: conversationDocId });
      }

      // Участников читаем из published-версии беседы — связь с пользователями
      // привязана к ней, у draft-версии список пустой
      const conversation = await strapi.documents('api::conversation.conversation').findOne({
        documentId: String(conversationDocId),
        status: 'published',
        fields: ['id', 'documentId'],
        populate: {
          users_permissions_users: { fields: ['id'], populate: { role: { fields: ['type'] } } },
        },
      });
      const participants = (conversation as any)?.users_permissions_users || [];
      const preview = ((result as any).content || '').slice(0, 80);

      const svc = strapi.service('api::notification.notification');

      if (isSupport && senderRole !== 'admin' && senderRole !== 'manager') {
        // Пациент написал в поддержку — уведомляем всех менеджеров и админов
        const staff = await strapi.query('plugin::users-permissions.user').findMany({
          where: { userRole: { $in: ['admin', 'manager'] } },
          select: ['id', 'userRole'],
        });

        for (const s of staff) {
          if (!s?.id || s.id === senderId) continue;
          const link = s.userRole === 'admin' ? '/admin/support' : '/manager';
          await svc.notifyUser(s.id, {
            title: `Обращение в поддержку от ${senderName}`,
            message: preview,
            type: 'message',
            link,
            metadata: { conversationId: conversationDocId, messageId: documentId, support: true },
          });
        }
        return;
      }

      for (const p of participants) {
        if (!p?.id || p.id === senderId) continue;
        const roleType = p?.role?.type;
        const link = isSupport
          ? '/patient?support=1'
          : roleType === 'doctor' ? '/doctor/chat' : roleType === 'admin' ? '/admin' : '/patient/chat';
        const title = isSupport
          ? `Ответ службы поддержки от ${senderName}`
          : `Сообщение от ${senderName}`;
        await svc.notifyUser(p.id, {
          title,
          message: preview,
          type: 'message',
          link,
          metadata: { conversationId: conversationDocId, messageId: documentId, ...(isSupport ? { support: true } : {}) },
        });
      }
    } catch (error) {
      strapi.log.error('message afterCreate notification error:', error);
    }
  },
};
