/**
 * Custom notification routes.
 * IMPORTANT: static paths must come before /:id routes.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/notifications/unread-count',
      handler: 'notification.unreadCount',
      info: { apiName: 'notification', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/notifications/mark-all-read',
      handler: 'notification.markAllAsRead',
      info: { apiName: 'notification', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/notifications/push-token',
      handler: 'notification.registerPushToken',
      info: { apiName: 'notification', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'DELETE',
      path: '/notifications/push-token',
      handler: 'notification.unregisterPushToken',
      info: { apiName: 'notification', type: 'content-api' },
      config: { policies: [] },
    },
  ],
};
