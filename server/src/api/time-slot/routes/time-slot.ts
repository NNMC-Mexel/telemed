/**
 * Time-slot routes с policies.
 * find/findOne — публичные (пациенты смотрят доступные слоты).
 * create — только doctor/admin (проверяется в controller).
 * update/delete — только владелец-доктор или admin.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::time-slot.time-slot', {
  config: {
    update: {
      policies: ['global::is-timeslot-owner'],
    },
    delete: {
      policies: ['global::is-timeslot-owner'],
    },
  },
});
