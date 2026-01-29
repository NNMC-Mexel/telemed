/**
 * Medical-document controller с ownership-фильтрацией.
 * Использует strapi.documents() напрямую, минуя REST sanitizer.
 * - Patient видит только свои документы
 * - Doctor видит документы своих пациентов
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::medical-document.medical-document', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const populate = ['file', 'user', 'doctor', 'appointment'] as any;
    const sort = (ctx.query?.sort as any) || ['createdAt:desc'];

    // Parse filters from query params
    const queryFilters = ctx.query?.filters as any;
    const typeFilter = queryFilters?.type?.$eq;
    const userIdFilter = queryFilters?.user?.id?.$eq;

    let filters: any = {};
    if (typeFilter) {
      filters.type = typeFilter;
    }

    if (!isAdmin) {
      const isDoctor = user.role?.type === 'doctor' || user.userRole === 'doctor';

      if (isDoctor) {
        if (userIdFilter) {
          // Doctor viewing specific patient's docs
          filters.user = { id: userIdFilter };
        } else {
          const doctorRecord = await strapi
            .query('api::doctor.doctor')
            .findOne({ where: { users_permissions_user: user.id } });

          if (doctorRecord) {
            filters.doctor = { id: doctorRecord.id };
          }
        }
      } else {
        // Patient sees only their own documents
        filters.user = { id: user.id };
      }
    } else if (userIdFilter) {
      filters.user = { id: userIdFilter };
    }

    const data = await strapi.documents('api::medical-document.medical-document').findMany({
      filters,
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

  async create(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const body = (ctx.request.body as any)?.data || ctx.request.body || {};

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const isDoctor = user.role?.type === 'doctor' || user.userRole === 'doctor';

    // Resolve user (patient) documentId
    let userDocId: string | undefined;
    if (!isAdmin && !isDoctor) {
      userDocId = user.documentId;
    } else if (body.user) {
      if (typeof body.user === 'number') {
        const found = await strapi.query('plugin::users-permissions.user').findOne({ where: { id: body.user } });
        userDocId = found?.documentId;
      } else {
        userDocId = body.user;
      }
    }

    // Resolve doctor documentId
    let doctorDocId: string | undefined;
    if (body.doctor) {
      if (typeof body.doctor === 'number') {
        const found = await strapi.query('api::doctor.doctor').findOne({ where: { id: body.doctor } });
        doctorDocId = found?.documentId;
      } else {
        doctorDocId = body.doctor;
      }
    }

    // Resolve appointment documentId
    let appointmentDocId: string | undefined;
    if (body.appointment) {
      if (typeof body.appointment === 'number') {
        const found = await strapi.query('api::appointment.appointment').findOne({ where: { id: body.appointment } });
        appointmentDocId = found?.documentId;
      } else {
        appointmentDocId = body.appointment;
      }
    }

    const document = await strapi.documents('api::medical-document.medical-document').create({
      data: {
        title: body.title,
        type: body.type || 'other',
        description: body.description || '',
        file: body.file,
        user: userDocId,
        doctor: doctorDocId,
        appointment: appointmentDocId,
      },
      status: 'published',
      populate: ['file', 'user', 'doctor', 'appointment'],
    });

    return { data: document };
  },
}));
