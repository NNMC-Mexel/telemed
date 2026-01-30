/**
 * Appointment lifecycle hooks.
 * After an appointment is updated with a rating:
 * 1. Create a Review entity linked to doctor, patient, appointment
 * 2. Recalculate the doctor's average rating and reviewsCount
 */

export default {
  async afterUpdate(event) {
    const { result, params } = event;

    // Check if rating was set in this update
    const updatedData = params?.data;
    if (!updatedData?.rating) return;

    const appointmentId = result?.documentId || result?.id;
    if (!appointmentId) return;

    try {
      // Fetch the full appointment with relations
      const appointment = await strapi.documents('api::appointment.appointment').findOne({
        documentId: String(appointmentId),
        populate: {
          doctor: true,
          patient: true,
        },
      });

      if (!appointment?.doctor || !appointment?.patient) return;

      const doctorDocId = appointment.doctor.documentId || appointment.doctor.id;
      const patientDocId = appointment.patient.documentId || appointment.patient.id;

      // Check if review already exists for this appointment
      const existingReviews = await strapi.documents('api::review.review').findMany({
        filters: {
          appointment: { documentId: String(appointmentId) },
        },
      });

      if (existingReviews.length === 0) {
        // Create Review entity
        await strapi.documents('api::review.review').create({
          data: {
            rating: appointment.rating,
            text: appointment.review || '',
            doctor: doctorDocId,
            patient: patientDocId,
            appointment: appointmentId,
            isPublished: true,
          } as any,
          status: 'published',
        });
      } else {
        // Update existing review
        await strapi.documents('api::review.review').update({
          documentId: existingReviews[0].documentId,
          data: {
            rating: appointment.rating,
            text: appointment.review || '',
            isPublished: true,
          } as any,
          status: 'published',
        });
      }

      // Recalculate doctor's average rating
      // Find the doctor record (api::doctor.doctor)
      const doctorRecord = await strapi.documents('api::doctor.doctor').findOne({
        documentId: String(doctorDocId),
        populate: { reviews: true },
      });

      if (doctorRecord) {
        // Get all reviews for this doctor
        const allReviews = await strapi.documents('api::review.review').findMany({
          filters: {
            doctor: { documentId: String(doctorDocId) },
          },
          status: 'published',
        });

        const reviewsCount = allReviews.length;
        const avgRating = reviewsCount > 0
          ? Math.round(allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsCount)
          : 0;

        strapi.log.info(`Updating doctor ${doctorDocId}: rating=${avgRating}, reviewsCount=${reviewsCount}`);

        // Update doctor's rating and reviewsCount
        await strapi.documents('api::doctor.doctor').update({
          documentId: String(doctorDocId),
          data: {
            rating: avgRating,
            reviewsCount: reviewsCount,
          } as any,
          status: 'published',
        });
      }
    } catch (error) {
      strapi.log.error('Error in appointment afterUpdate lifecycle (rating):', error);
    }
  },
};
