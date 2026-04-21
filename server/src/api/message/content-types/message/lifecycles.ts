/**
 * Message lifecycle hooks.
 * afterCreate: создаёт уведомление для всех участников беседы, кроме отправителя.
 */

export default {
  async afterCreate(event) {
    const { result } = event;
    const documentId = result?.documentId;
    if (!documentId) return;

    try {
      const msg = await strapi.documents('api::message.message').findOne({
        documentId: String(documentId),
        populate: {
          sender: { fields: ['id', 'fullName'] },
          conversation: {
            populate: {
              users_permissions_users: { fields: ['id'], populate: { role: { fields: ['type'] } } },
            },
          },
        },
      });

      const senderId = (msg as any)?.sender?.id;
      const senderName = (msg as any)?.sender?.fullName || 'Собеседник';
      const participants = (msg as any)?.conversation?.users_permissions_users || [];
      const conversationDocId = (msg as any)?.conversation?.documentId;
      const preview = ((result as any).content || '').slice(0, 80);

      const svc = strapi.service('api::notification.notification');

      for (const p of participants) {
        if (!p?.id || p.id === senderId) continue;
        const roleType = p?.role?.type;
        const link =
          roleType === 'doctor' ? '/doctor/chat' : roleType === 'admin' ? '/admin' : '/patient/chat';
        await svc.notifyUser(p.id, {
          title: `Сообщение от ${senderName}`,
          message: preview,
          type: 'message',
          link,
          metadata: { conversationId: conversationDocId, messageId: documentId },
        });
      }
    } catch (error) {
      strapi.log.error('message afterCreate notification error:', error);
    }
  },
};
