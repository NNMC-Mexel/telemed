/**
 *  global controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::global.global', () => ({
  async patientGuide(ctx) {
    const globalConfig = await strapi.documents('api::global.global').findFirst({
      fields: ['patientGuideConfig'],
    } as any);

    return {
      data: {
        patientGuideConfig: (globalConfig as any)?.patientGuideConfig || null,
      },
    };
  },
}));
