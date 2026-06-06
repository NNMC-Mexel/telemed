/**
 * Notification service.
 * Основной helper: strapi.service('api::notification.notification').notifyUser(userId, payload)
 * Используется в lifecycle-хуках других сущностей для авто-создания уведомлений.
 */
import { factories } from '@strapi/strapi';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

type NotificationType = 'appointment' | 'reminder' | 'message' | 'document' | 'video' | 'system';

interface NotifyPayload {
  title: string;
  message?: string;
  type?: NotificationType;
  link?: string;
  metadata?: any;
}

let firebaseWarned = false;

const normalizePushTokens = (value: any) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item?.enabled !== false && typeof item?.token === 'string' && item.token.trim())
    .map((item) => ({
      ...item,
      token: String(item.token).trim(),
    }));
};

const getFirebaseServiceAccount = () => {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const rawBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const rawPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (rawJson) return JSON.parse(rawJson);
  if (rawBase64) return JSON.parse(Buffer.from(rawBase64, 'base64').toString('utf8'));
  if (rawPath) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(rawPath);
  }
  return null;
};

const getFirebaseMessagingClient = () => {
  if (getApps().length > 0) return getMessaging();

  try {
    const serviceAccount = getFirebaseServiceAccount();
    if (serviceAccount) {
      initializeApp({ credential: cert(serviceAccount) });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({ credential: applicationDefault() });
    } else {
      if (!firebaseWarned) {
        strapi.log.warn(
          'Push notifications are disabled: configure FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS',
        );
        firebaseWarned = true;
      }
      return null;
    }
    return getMessaging();
  } catch (err: any) {
    strapi.log.error(`Firebase initialization failed: ${err?.message || err}`);
    return null;
  }
};

const compactData = (payload: NotifyPayload, notification: any) => {
  const data: Record<string, string> = {
    notificationId: String(notification?.documentId || notification?.id || ''),
    type: payload.type || 'system',
  };
  if (payload.link) data.link = payload.link;
  if (payload.metadata !== undefined && payload.metadata !== null) {
    data.metadata = JSON.stringify(payload.metadata).slice(0, 3500);
  }
  return data;
};

const pruneInvalidTokens = async (userId: number | string, existingTokens: any[], invalidTokens: Set<string>) => {
  if (invalidTokens.size === 0) return;
  const nextTokens = existingTokens.filter((item) => !invalidTokens.has(item.token));
  await strapi.query('plugin::users-permissions.user').update({
    where: { id: userId },
    data: { pushTokens: nextTokens },
  });
};

const sendPushToUser = async (userRecord: any, payload: NotifyPayload, notification: any) => {
  const storedTokens = normalizePushTokens(userRecord?.pushTokens);
  const tokens = Array.from(new Set(storedTokens.map((item) => item.token)));
  if (tokens.length === 0) return;

  const messaging = getFirebaseMessagingClient();
  if (!messaging) return;

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: payload.title,
        body: payload.message || '',
      },
      data: compactData(payload, notification),
      android: {
        priority: 'high',
        notification: {
          channelId: 'medconnect_default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });

    const invalidTokens = new Set<string>();
    response.responses.forEach((item, index) => {
      const code = item.error?.code;
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.add(tokens[index]);
      }
    });
    await pruneInvalidTokens(userRecord.id, storedTokens, invalidTokens);

    if (response.failureCount > 0) {
      strapi.log.warn(
        `Push notification partial failure for user ${userRecord.id}: ${response.failureCount}/${tokens.length}`,
      );
    }
  } catch (err: any) {
    strapi.log.error(`Push notification send failed for user ${userRecord?.id}: ${err?.message || err}`);
  }
};

export default factories.createCoreService('api::notification.notification', () => ({
  async notifyUser(userId: number | string, payload: NotifyPayload) {
    if (!userId) return null;

    try {
      const userRecord = await strapi
        .query('plugin::users-permissions.user')
        .findOne({ where: { id: userId } });
      if (!userRecord?.documentId) return null;

      const notification = await strapi.documents('api::notification.notification').create({
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

      await sendPushToUser(userRecord, payload, notification);
      return notification;
    } catch (err) {
      strapi.log.error('notification.notifyUser failed:', err);
      return null;
    }
  },
}));
