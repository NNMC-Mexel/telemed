/**
 * Doctor routes с policies.
 * find/findOne — доступны по permissions роли (public + authenticated).
 * create — только admin.
 * update — только владелец профиля или admin.
 * delete — только admin.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::doctor.doctor', {
  config: {
    create: {
      policies: ['global::is-admin'],
    },
    update: {
      policies: ['global::is-doctor-profile-owner'],
    },
    delete: {
      policies: ['global::is-admin'],
    },
  },
});
