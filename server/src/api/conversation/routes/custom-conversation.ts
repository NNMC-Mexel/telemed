/**
 * Custom routes для conversation.
 * POST /conversations/support — get-or-create support-тред текущего пользователя.
 * PUT /conversations/:id/support-status — смена статуса обращения (staff).
 */
export default {
  routes: [
    {
      method: 'POST',
      path: '/conversations/support',
      handler: 'conversation.support',
      info: { apiName: 'conversation', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/conversations/:id/support-status',
      handler: 'conversation.setSupportStatus',
      info: { apiName: 'conversation', type: 'content-api' },
      config: { policies: [] },
    },
  ],
};
