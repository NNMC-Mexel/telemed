/**
 * Cron: mark appointments as no_show if nobody joined within the grace period.
 *
 * Runs every 5 minutes. Targets appointments with statuse confirmed/pending
 * whose dateTime is more than NO_SHOW_GRACE_MIN minutes in the past.
 * The signaling server sets statuse=in_progress as soon as the first participant
 * joins the room, so in_progress / completed / cancelled are never touched.
 */

const NO_SHOW_GRACE_MIN = 15;

export default {
  markNoShowAppointments: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        const cutoff = new Date(Date.now() - NO_SHOW_GRACE_MIN * 60 * 1000);

        const overdue = await strapi.documents('api::appointment.appointment').findMany({
          filters: {
            statuse: { $in: ['pending', 'confirmed'] },
            dateTime: { $lt: cutoff.toISOString() },
          },
          fields: ['documentId'],
        });

        if (overdue.length === 0) return;

        strapi.log.info(`[cron:no_show] Marking ${overdue.length} appointment(s) as no_show`);

        await Promise.all(
          overdue.map((appt: any) =>
            strapi
              .documents('api::appointment.appointment')
              .update({ documentId: appt.documentId, data: { statuse: 'no_show' } })
              .catch((err: any) =>
                strapi.log.error(`[cron:no_show] Failed ${appt.documentId}: ${err.message}`)
              )
          )
        );
      } catch (err: any) {
        strapi.log.error('[cron:no_show] Unexpected error:', err.message);
      }
    },
    options: {
      rule: '*/5 * * * *',
    },
  },
};
