/**
 * Custom routes для appointment.
 * GET /appointments/can-join/:roomId — авторитетная серверная проверка
 * временного окна для подключения к видеоконсультации.
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/appointments/can-join/:roomId',
      handler: 'appointment.canJoin',
      info: { apiName: 'appointment', type: 'content-api' },
      config: { policies: [] },
    },
  ],
};
