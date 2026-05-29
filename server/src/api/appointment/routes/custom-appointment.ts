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
      path: '/appointments/slot-conflicts',
      handler: 'appointment.findSlotConflicts',
      info: { apiName: 'appointment', type: 'content-api' },
      // auth: false removed — API-token bearer sent by signaling-server bypasses
      // users-permissions policy entirely. User JWT also accepted for direct calls.
      config: { policies: [] },
    },
  ],
};
