/**
 * Appointment controller с ownership-фильтрацией.
 * - Patient видит только свои appointments
 * - Doctor видит только свои appointments
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::appointment.appointment', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const populate = {
      doctor: { populate: ['specialization', 'photo'] },
      patient: { fields: ['id', 'fullName', 'email', 'phone', 'username'] },
    } as any;
    const sort = (ctx.query?.sort as any) || ['dateTime:desc'];

    // Parse roomId filter from query params
    const queryFilters = ctx.query?.filters as any;
    const roomIdFilter = queryFilters?.roomId?.$eq;

    // Build additional filters
    let additionalFilters: any = {};
    if (roomIdFilter) {
      additionalFilters.roomId = roomIdFilter;
    }

    if (!isAdmin) {
      const isDoctor = user.role?.type === 'doctor' || user.userRole === 'doctor';

      if (isDoctor) {
        // Находим doctor запись по users_permissions_user (id)
        const doctorRecord = await strapi
          .query('api::doctor.doctor')
          .findOne({ where: { users_permissions_user: user.id } });

        if (!doctorRecord?.documentId) {
          return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
        }

        const byId = await strapi.documents('api::appointment.appointment').findMany({
          filters: { doctor: { id: doctorRecord.id }, ...additionalFilters },
          sort,
          populate,
        });
        const byDocId = await strapi.documents('api::appointment.appointment').findMany({
          filters: { doctor: { documentId: doctorRecord.documentId }, ...additionalFilters },
          sort,
          populate,
        });
        const merged = [...byId, ...byDocId];
        const uniq = Array.from(new Map(merged.map((item: any) => [item.documentId, item])).values());
        return {
          data: uniq,
          meta: { pagination: { page: 1, pageSize: uniq.length, pageCount: 1, total: uniq.length } },
        };
      } else {
        // Фильтруем по patient (users-permissions user)
        const patientId = user.id;
        const patientDocId = user.documentId;
        const byId = await strapi.documents('api::appointment.appointment').findMany({
          filters: { patient: { id: patientId }, ...additionalFilters },
          sort,
          populate,
        });
        const byDocId = patientDocId
          ? await strapi.documents('api::appointment.appointment').findMany({
              filters: { patient: { documentId: patientDocId }, ...additionalFilters },
              sort,
              populate,
            })
          : [];
        const merged = [...byId, ...byDocId];
        const uniq = Array.from(new Map(merged.map((item: any) => [item.documentId, item])).values());
        return {
          data: uniq,
          meta: { pagination: { page: 1, pageSize: uniq.length, pageCount: 1, total: uniq.length } },
        };
      }
    }

    const data = await strapi.documents('api::appointment.appointment').findMany({
      filters: additionalFilters,
      sort,
      populate,
    });

    return {
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: data.length,
          pageCount: 1,
          total: data.length,
        },
      },
    };
  },

  async findOne(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const { id } = ctx.params;
    const populate = {
      doctor: { populate: ['specialization', 'photo'] },
      patient: { fields: ['id', 'fullName', 'email', 'phone', 'username'] },
      medical_documents: true,
    } as any;

    const appointment = await strapi.documents('api::appointment.appointment').findOne({
      documentId: id,
      populate,
    });

    if (!appointment) {
      return ctx.notFound('Appointment not found');
    }

    return { data: appointment };
  },

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isPatient = user.role?.type === 'patient' || user.userRole === 'patient';
    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';

    if (!isPatient && !isAdmin) {
      return ctx.forbidden('Only patients can create appointments');
    }

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};

    // --- Resolve patient documentId ---
    let patientDocId: string | undefined;
    if (!isAdmin) {
      // Force current user as patient
      patientDocId = user.documentId;
    } else if (body.patient) {
      if (typeof body.patient === 'number') {
        const found = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: body.patient } });
        patientDocId = found?.documentId;
      } else {
        patientDocId = body.patient;
      }
    }

    // --- Resolve doctor documentId ---
    let doctorDocId: string | undefined;
    if (body.doctor) {
      if (typeof body.doctor === 'number') {
        const found = await strapi.query('api::doctor.doctor').findOne({ where: { id: body.doctor } });
        doctorDocId = found?.documentId;
      } else {
        doctorDocId = body.doctor;
      }
    }

    // Create appointment via document service (bypasses REST API sanitizer)
    const appointment = await strapi.documents('api::appointment.appointment').create({
      data: {
        dateTime: body.dateTime,
        type: body.type || 'video',
        statuse: body.statuse || body.status || 'pending',
        price: body.price,
        roomId: body.roomId,
        paymentStatus: body.paymentStatus || 'pending',
        patient: patientDocId,
        doctor: doctorDocId,
      },
      status: 'published',
      populate: {
        doctor: { populate: ['specialization', 'photo'] },
        patient: { fields: ['id', 'fullName', 'email', 'phone'] },
      },
    });

    return { data: appointment };
  },
}));
