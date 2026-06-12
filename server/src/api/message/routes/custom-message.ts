/**
 * Custom routes для message.
 * POST /messages/mark-read — отметить чужие сообщения беседы прочитанными.
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/messages/mark-read',
      handler: 'message.markConversationRead',
      info: { apiName: 'message', type: 'content-api' },
      config: { policies: [] },
    },
  ],
};
