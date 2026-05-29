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
    {
      method: 'GET',
      path: '/appointments/booked-slots/:doctorId',
      handler: 'appointment.findBookedSlots',
      info: { apiName: 'appointment', type: 'content-api' },
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/appointments/slot-conflicts/check',
      handler: 'appointment.findSlotConflicts',
      info: { apiName: 'appointment', type: 'content-api' },
      // Keep this route at two path segments after /appointments. A single
      // segment such as /appointments/slot-conflicts is swallowed by the core
      // /appointments/:id route before this custom handler can run.
      config: { policies: [] },
    },
  ],
};
