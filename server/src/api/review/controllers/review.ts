/**
 * Review controller.
 * При создании:
 *  1. patient принудительно = текущий user
 *  2. Проверяем что у пациента есть ЗАВЕРШЁННЫЙ приём с данным врачом
 *  3. Проверяем что отзыв на этот приём ещё не оставлен
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::review.review', ({ strapi }) => ({
  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};

    if (!isAdmin) {
      // 1. Determine which doctor this review is for
      const doctorRef = body.doctor;
      if (!doctorRef) return ctx.badRequest('doctor is required');

      // Resolve doctor record
      let doctorRecord: any;
      if (typeof doctorRef === 'number') {
        doctorRecord = await strapi.query('api::doctor.doctor').findOne({ where: { id: doctorRef } });
      } else {
        doctorRecord = await strapi.query('api::doctor.doctor').findOne({ where: { documentId: doctorRef } });
      }
      if (!doctorRecord) return ctx.badRequest('Doctor not found');

      // 2. Resolve the appointment this review is for
      const apptRef = body.appointment;
      if (!apptRef) return ctx.badRequest('appointment is required');

      const apptRecord: any = typeof apptRef === 'string'
        ? await strapi.documents('api::appointment.appointment').findOne({ documentId: apptRef, populate: { patient: { fields: ['id', 'documentId'] }, doctor: { fields: ['id', 'documentId'] } } })
        : await strapi.query('api::appointment.appointment').findOne({ where: { id: apptRef }, populate: ['patient', 'doctor'] });

      if (!apptRecord) return ctx.badRequest('Appointment not found');

      // Appointment must be completed, belong to this patient, and match the doctor
      if (apptRecord.statuse !== 'completed') {
        return ctx.forbidden('You can only review a completed consultation');
      }
      if (apptRecord.patient?.documentId !== user.documentId) {
        return ctx.forbidden('This appointment does not belong to you');
      }
      if (apptRecord.doctor?.documentId !== doctorRecord.documentId) {
        return ctx.badRequest('Appointment doctor does not match the review doctor');
      }

      // 3. One review per appointment (allows a new review for each new completed consultation)
      const existingReview = await strapi.documents('api::review.review').findMany({
        filters: { appointment: { documentId: apptRecord.documentId } },
        fields: ['id'],
      });

      if (existingReview.length > 0) {
        return ctx.badRequest('You have already submitted a review for this appointment');
      }

      // 4. Force patient = current user, use server-resolved ids
      ctx.request.body = {
        ...(ctx.request.body as any),
        data: {
          ...body,
          patient: user.documentId,
          doctor: doctorRecord.documentId,
          appointment: apptRecord.documentId,
        },
      };
    }

    return await super.create(ctx);
  },
}));
