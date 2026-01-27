/**
 * Appointment routes с policies для ownership-проверок.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::appointment.appointment', {
  config: {
    findOne: {
      policies: ['global::is-appointment-participant'],
    },
    update: {
      policies: ['global::is-appointment-participant'],
    },
    delete: {
      policies: ['global::is-admin'],
    },
  },
});
