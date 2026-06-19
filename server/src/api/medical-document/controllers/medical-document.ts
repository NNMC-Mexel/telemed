/**
 * Medical-document controller с ownership-фильтрацией и sharing.
 * - Patient видит только свои документы
 * - Doctor видит документы своих пациентов + расшаренные ему
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';

const DOCTOR_DOCUMENT_WINDOW_HOURS = 48;

const isUserAdmin = (user: any) => user?.role?.type === 'admin' || user?.userRole === 'admin';
const isUserDoctor = (user: any) => user?.role?.type === 'doctor' || user?.userRole === 'doctor';

const getDoctorForUser = (userId: number | string) =>
  strapi.query('api::doctor.doctor').findOne({ where: { users_permissions_user: userId } });

const getAppointmentForDocumentWrite = async (appointmentRef: number | string) => {
  if (typeof appointmentRef === 'number') {
    return strapi.query('api::appointment.appointment').findOne({
      where: { id: appointmentRef },
      populate: { doctor: true },
    });
  }

  return strapi.documents('api::appointment.appointment').findOne({
    documentId: String(appointmentRef),
    populate: { doctor: { fields: ['id', 'documentId', 'consultationDuration'] } },
  });
};

const getDoctorAppointmentDocumentWriteViolation = (appointment: any, doctorRecord: any) => {
  const apptDoctorDocId = appointment?.doctor?.documentId;
  if (!doctorRecord || apptDoctorDocId !== doctorRecord.documentId) {
    return { type: 'forbidden', message: 'You can only upload documents for your own appointments' };
  }

  const appointmentStatus = (appointment as any).statuse;
  if (!['completed', 'in_progress'].includes(appointmentStatus)) {
    return { type: 'badRequest', message: 'Medical conclusion documents can only be created after a completed consultation' };
  }

  const appointmentTime = new Date((appointment as any).dateTime);
  if (Number.isNaN(appointmentTime.getTime())) {
    return { type: 'badRequest', message: 'Appointment has invalid dateTime' };
  }

  const durationMinutes = Number((appointment as any).doctor?.consultationDuration) || 30;
  const consultationEnd = new Date(appointmentTime.getTime() + (durationMinutes * 60 * 1000));
  const now = new Date();

  if (now < consultationEnd) {
    return { type: 'badRequest', message: 'Medical conclusion documents can only be created after the consultation has ended' };
  }

  const windowEnd = new Date(consultationEnd.getTime() + (DOCTOR_DOCUMENT_WINDOW_HOURS * 60 * 60 * 1000));

  if (now > windowEnd) {
    return { type: 'badRequest', message: `Medical conclusion documents can only be changed within ${DOCTOR_DOCUMENT_WINDOW_HOURS} hours after the consultation` };
  }

  return null;
};

const applyWriteViolation = (ctx: any, violation: { type: string; message: string } | null) => {
  if (!violation) return false;
  if (violation.type === 'forbidden') {
    ctx.forbidden(violation.message);
  } else {
    ctx.badRequest(violation.message);
  }
  return true;
};

export default factories.createCoreController('api::medical-document.medical-document', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = isUserAdmin(user);
    const populate = ['file', 'user', 'doctor', 'appointment', 'sharedWithDoctors'] as any;
    const sort = (ctx.query?.sort as any) || ['createdAt:desc'];

    const queryFilters = ctx.query?.filters as any;
    const typeFilter = queryFilters?.type?.$eq;
    const userIdFilter = queryFilters?.user?.id?.$eq;

    let filters: any = {};
    if (typeFilter) {
      filters.type = typeFilter;
    }

    if (!isAdmin) {
      const isDoctor = isUserDoctor(user);

      if (isDoctor) {
        const doctorRecord = await strapi
          .query('api::doctor.doctor')
          .findOne({ where: { users_permissions_user: user.id } });

        if (!doctorRecord) {
          return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
        }

        if (userIdFilter) {
          // Doctor viewing specific patient's docs — show appointment-linked + shared
          const allDocs = await strapi.documents('api::medical-document.medical-document').findMany({
            filters: { user: { id: userIdFilter } },
            sort,
            populate,
          });

          // Filter: doctor's own docs OR shared with this doctor
          const data = allDocs.filter((doc: any) => {
            const isOwn = doc.doctor?.id === doctorRecord.id || doc.doctor?.documentId === doctorRecord.documentId;
            const isShared = doc.sharedWithDoctors?.some(
              (d: any) => d.id === doctorRecord.id || d.documentId === doctorRecord.documentId
            );
            return isOwn || isShared;
          });

          return {
            data,
            meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
          };
        } else {
          // Doctor viewing all their docs (own + shared)
          const [ownDocs, sharedDocs] = await Promise.all([
            strapi.documents('api::medical-document.medical-document').findMany({
              filters: { doctor: { id: doctorRecord.id }, ...filters },
              sort,
              populate,
            }),
            strapi.documents('api::medical-document.medical-document').findMany({
              filters: { sharedWithDoctors: { id: doctorRecord.id }, ...filters },
              sort,
              populate,
            }),
          ]);

          // Merge and deduplicate
          const seen = new Set<any>();
          const data: any[] = [];
          for (const doc of [...ownDocs, ...sharedDocs]) {
            if (!seen.has(doc.id)) {
              seen.add(doc.id);
              data.push(doc);
            }
          }

          return {
            data,
            meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
          };
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

    const isAdmin = isUserAdmin(user);
    const isDoctor = isUserDoctor(user);

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

    // Resolve appointment documentId + validate doctor is the appointment's doctor
    let appointmentDocId: string | undefined;
    if (body.appointment) {
      let appointmentRecord: any;
      if (typeof body.appointment === 'number') {
        appointmentRecord = await strapi.query('api::appointment.appointment').findOne({
          where: { id: body.appointment },
          populate: { doctor: true },
        });
      } else {
        appointmentRecord = await strapi.documents('api::appointment.appointment').findOne({
          documentId: body.appointment,
          populate: { doctor: { fields: ['id', 'documentId'] } },
        });
      }

      if (!appointmentRecord) return ctx.badRequest('Appointment not found');
      appointmentDocId = appointmentRecord.documentId;

      // If a doctor is uploading, verify they are the doctor in the linked appointment
      if (isDoctor && !isAdmin) {
        const doctorRecord = await getDoctorForUser(user.id);
        if (applyWriteViolation(ctx, getDoctorAppointmentDocumentWriteViolation(appointmentRecord, doctorRecord))) {
          return;
        }
      }

      // If a patient is uploading, verify they are the patient in the linked appointment
      if (!isDoctor && !isAdmin) {
        const aptWithPatient = await strapi.documents('api::appointment.appointment').findOne({
          documentId: appointmentDocId,
          populate: { patient: { fields: ['id'] } },
        });
        if (!aptWithPatient || (aptWithPatient as any).patient?.id !== user.id) {
          return ctx.forbidden('You can only upload documents for your own appointments');
        }
      }
    }

    // Resolve sharedWithDoctors documentIds
    let sharedDoctorDocIds: string[] | undefined;
    if (body.sharedWithDoctors && Array.isArray(body.sharedWithDoctors)) {
      sharedDoctorDocIds = [];
      for (const ref of body.sharedWithDoctors) {
        if (typeof ref === 'number') {
          const found = await strapi.query('api::doctor.doctor').findOne({ where: { id: ref } });
          if (found?.documentId) sharedDoctorDocIds.push(found.documentId);
        } else {
          sharedDoctorDocIds.push(ref);
        }
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
        sharedWithDoctors: sharedDoctorDocIds,
      },
      status: 'published',
      populate: ['file', 'user', 'doctor', 'appointment', 'sharedWithDoctors'],
    });

    return { data: document };
  },

  async update(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const isAdmin = isUserAdmin(user);
    const isDoctor = isUserDoctor(user);
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const { id } = ctx.params;

    const existing = await strapi.documents('api::medical-document.medical-document').findOne({
      documentId: id,
      populate: {
        user: { fields: ['id'] },
        doctor: { fields: ['id', 'documentId'] },
        appointment: {
          fields: ['id', 'documentId', 'dateTime', 'statuse'],
          populate: { doctor: { fields: ['id', 'documentId', 'consultationDuration'] } },
        },
      } as any,
    });

    if (!existing) return ctx.notFound('Document not found');

    if (!isAdmin && isDoctor) {
      const doctorRecord = await getDoctorForUser(user.id);
      const documentDoctorDocId = (existing as any).doctor?.documentId;
      if (!doctorRecord || documentDoctorDocId !== doctorRecord.documentId) {
        return ctx.forbidden('You can only update documents you created for your own appointments');
      }

      let appointmentRecord = (existing as any).appointment;
      if (body.appointment) {
        appointmentRecord = await getAppointmentForDocumentWrite(body.appointment);
        if (!appointmentRecord) return ctx.badRequest('Appointment not found');
      }

      if (appointmentRecord) {
        if (applyWriteViolation(ctx, getDoctorAppointmentDocumentWriteViolation(appointmentRecord, doctorRecord))) {
          return;
        }
      }
    }

    const updated = await strapi.documents('api::medical-document.medical-document').update({
      documentId: id,
      data: body,
      status: 'published',
      populate: ['file', 'user', 'doctor', 'appointment', 'sharedWithDoctors'],
    });

    return { data: updated };
  },

  /**
   * Share a document with specific doctors.
   * PUT /api/medical-documents/:id/share
   * Body: { doctorIds: [documentId1, documentId2, ...] }
   */
  async share(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    const { id } = ctx.params;
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};
    const doctorIds: string[] = body.doctorIds || [];

    // Fetch document with owner check
    const doc = await strapi.documents('api::medical-document.medical-document').findOne({
      documentId: id,
      populate: ['user', 'sharedWithDoctors'],
    });

    if (!doc) return ctx.notFound('Document not found');

    // Only the document owner (patient) or admin can share
    const isAdmin = isUserAdmin(user);
    if (!isAdmin && (doc as any).user?.id !== user.id) {
      return ctx.forbidden('Only the document owner can manage sharing');
    }

    // Validate that all doctorIds are real doctors
    if (doctorIds.length > 0) {
      const validDoctors = await strapi.documents('api::doctor.doctor').findMany({
        filters: { documentId: { $in: doctorIds } },
        fields: ['id', 'documentId'],
      });
      const validIds = new Set(validDoctors.map((d: any) => d.documentId));
      const invalid = doctorIds.filter(id => !validIds.has(id));
      if (invalid.length > 0) {
        return ctx.badRequest('Some doctor IDs are invalid');
      }
    }

    // Update sharedWithDoctors
    const updated = await strapi.documents('api::medical-document.medical-document').update({
      documentId: id,
      data: {
        sharedWithDoctors: doctorIds,
      } as any,
      status: 'published',
      populate: ['file', 'user', 'doctor', 'appointment', 'sharedWithDoctors'],
    });

    return { data: updated };
  },

  /**
   * Get list of doctors the patient has had appointments with (for sharing UI).
   * GET /api/medical-documents/my-doctors
   */
  async myDoctors(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.forbidden('Not authenticated');

    // Get all appointments for this patient to find their doctors
    const appointments = await strapi.documents('api::appointment.appointment').findMany({
      filters: { patient: { id: user.id } },
      populate: {
        doctor: { populate: ['specialization', 'photo'] },
      } as any,
    });

    // Extract unique doctors
    const doctorMap = new Map<number, any>();
    for (const apt of appointments) {
      const dr = (apt as any).doctor;
      if (dr && !doctorMap.has(dr.id)) {
        doctorMap.set(dr.id, {
          id: dr.id,
          documentId: dr.documentId,
          fullName: dr.fullName,
          specialization: dr.specialization,
          photo: dr.photo,
        });
      }
    }

    return { data: Array.from(doctorMap.values()) };
  },
}));
