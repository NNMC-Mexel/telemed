/**
 * Cron: mark appointments as no_show if nobody joined within the grace period.
 *
 * Runs every 5 minutes. Targets appointments with statuse confirmed/pending
 * whose dateTime is more than NO_SHOW_GRACE_MIN minutes in the past.
 * The signaling server sets statuse=in_progress as soon as the first participant
 * joins the room, so in_progress / completed / cancelled are never touched.
 */

const NO_SHOW_GRACE_MIN = 15;

const shouldRemindPreparation = (appointment: any) => {
  const documentsStatus = appointment?.patientDocumentsStatus || 'not_provided';
  return documentsStatus === 'not_provided' ||
    documentsStatus === 'will_upload_later' ||
    (documentsStatus === 'uploaded' && appointment?.doctorAccessGranted !== true);
};

const sendPreparationReminder = async (strapi: any, appointment: any, bucket: '24h' | '2h') => {
  const patientId = appointment?.patient?.id;
  if (!patientId) return;

  const doctorName = appointment?.doctor?.fullName || 'врач';
  const link = `/patient/appointments/${appointment.documentId}`;
  const title = bucket === '24h'
    ? 'Подготовьте документы к консультации'
    : 'Консультация скоро: проверьте документы';
  const message = appointment?.doctorAccessGranted === true
    ? `До консультации с ${doctorName} можно загрузить анализы и выписки.`
    : `Загрузите анализы и разрешите доступ врачу ${doctorName}, чтобы он мог подготовиться.`;

  await strapi.service('api::notification.notification').notifyUser(patientId, {
    title,
    message,
    type: 'reminder',
    link,
    metadata: {
      appointmentId: appointment.documentId,
      reminder: `preparation_${bucket}`,
    },
  });
};

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
  remindAppointmentPreparation: {
    task: async ({ strapi }: { strapi: any }) => {
      try {
        const now = new Date();
        const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const inTwentyFourHours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const inTwentyFiveHours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

        const appointments = await strapi.documents('api::appointment.appointment').findMany({
          filters: {
            statuse: { $in: ['pending', 'confirmed'] },
            dateTime: {
              $gte: now.toISOString(),
              $lte: inTwentyFiveHours.toISOString(),
            },
          },
          populate: {
            patient: { fields: ['id'] },
            doctor: { fields: ['fullName'] },
          },
        });

        for (const appointment of appointments) {
          if (!shouldRemindPreparation(appointment)) continue;

          const appointmentTime = new Date((appointment as any).dateTime);
          const updates: Record<string, string> = {};

          if (
            appointmentTime <= inTwentyFourHours &&
            appointmentTime > inTwoHours &&
            !(appointment as any).preparationReminder24hSentAt
          ) {
            await sendPreparationReminder(strapi, appointment, '24h');
            updates.preparationReminder24hSentAt = now.toISOString();
          }

          if (
            appointmentTime <= inTwoHours &&
            !(appointment as any).preparationReminder2hSentAt
          ) {
            await sendPreparationReminder(strapi, appointment, '2h');
            updates.preparationReminder2hSentAt = now.toISOString();
          }

          if (Object.keys(updates).length > 0) {
            await strapi.documents('api::appointment.appointment').update({
              documentId: (appointment as any).documentId,
              data: updates,
              status: 'published',
            });
          }
        }
      } catch (err: any) {
        strapi.log.error('[cron:preparation_reminder] Unexpected error:', err.message);
      }
    },
    options: {
      rule: '*/15 * * * *',
    },
  },
};
