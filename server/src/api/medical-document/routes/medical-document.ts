/**
 * Medical-document routes с policies.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::medical-document.medical-document', {
  config: {
    findOne: {
      policies: ['global::is-medical-document-participant'],
    },
    update: {
      policies: ['global::is-medical-document-participant'],
    },
    delete: {
      policies: ['global::is-owner'],
    },
  },
});
