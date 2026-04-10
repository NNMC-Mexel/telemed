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

      // 2. Verify the patient has a completed appointment with this doctor
      const completedAppointments = await strapi.documents('api::appointment.appointment').findMany({
        filters: {
          patient: { documentId: user.documentId },
          doctor: { documentId: doctorRecord.documentId },
          statuse: 'completed',
        },
        fields: ['id', 'documentId'],
      });

      if (completedAppointments.length === 0) {
        return ctx.forbidden('You can only review a doctor after a completed consultation');
      }

      // 3. Check no review already exists for this doctor from this patient
      const existingReview = await strapi.documents('api::review.review').findMany({
        filters: {
          patient: { documentId: user.documentId },
          doctor: { documentId: doctorRecord.documentId },
        },
        fields: ['id'],
      });

      if (existingReview.length > 0) {
        return ctx.badRequest('You have already submitted a review for this doctor');
      }

      // 4. Force patient = current user, use server-resolved doctorDocId
      ctx.request.body = {
        ...(ctx.request.body as any),
        data: {
          ...body,
          patient: user.documentId,
          doctor: doctorRecord.documentId,
        },
      };
    }

    return await super.create(ctx);
  },
}));
