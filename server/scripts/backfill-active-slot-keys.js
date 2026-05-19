'use strict';

/**
 * Backfills activeSlotKey for active appointments so the DB-level unique guard
 * can protect existing production data after deployment.
 */

const ACTIVE_STATUSES = ['pending', 'confirmed', 'in_progress'];

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    const appointments = await strapi.documents('api::appointment.appointment').findMany({
      filters: { statuse: { $in: ACTIVE_STATUSES } },
      populate: { doctor: { fields: ['documentId'] } },
      fields: ['documentId', 'dateTime', 'statuse'],
      limit: 10000,
    });

    let updated = 0;
    for (const appointment of appointments) {
      const doctorDocId = appointment.doctor?.documentId;
      if (!doctorDocId || !appointment.dateTime) continue;

      const activeSlotKey = `${doctorDocId}:${new Date(appointment.dateTime).toISOString()}`;
      await strapi.documents('api::appointment.appointment').update({
        documentId: appointment.documentId,
        data: { activeSlotKey },
        status: 'published',
      });
      updated += 1;
    }

    console.log(`Backfilled activeSlotKey for ${updated} appointment(s).`);
  } finally {
    await app.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
