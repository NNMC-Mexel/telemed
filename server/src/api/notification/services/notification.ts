/**
 * Notification service.
 * Основной helper: strapi.service('api::notification.notification').notifyUser(userId, payload)
 * Используется в lifecycle-хуках других сущностей для авто-создания уведомлений.
 */
import { factories } from '@strapi/strapi';

type NotificationType = 'appointment' | 'reminder' | 'message' | 'document' | 'video' | 'system';

interface NotifyPayload {
  title: string;
  message?: string;
  type?: NotificationType;
  link?: string;
  metadata?: any;
}

export default factories.createCoreService('api::notification.notification', () => ({
  async notifyUser(userId: number | string, payload: NotifyPayload) {
    if (!userId) return null;

    try {
      const userRecord = await strapi
        .query('plugin::users-permissions.user')
        .findOne({ where: { id: userId } });
      if (!userRecord?.documentId) return null;

      return await strapi.documents('api::notification.notification').create({
        data: {
          title: payload.title,
          message: payload.message || '',
          type: payload.type || 'system',
          link: payload.link || null,
          metadata: payload.metadata || null,
          isRead: false,
          user: userRecord.documentId,
        } as any,
      });
    } catch (err) {
      strapi.log.error('notification.notifyUser failed:', err);
      return null;
    }
  },
}));
