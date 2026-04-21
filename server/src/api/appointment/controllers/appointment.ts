/**
 * Appointment controller с ownership-фильтрацией.
 * - Patient видит только свои appointments
 * - Doctor видит только свои appointments
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';

// ── Slot mutex: prevents two concurrent creates for the same doctor+time ──
const slotLocks = new Map<string, Promise<void>>();

function withSlotLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = slotLocks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn); // run fn after previous finishes (even if it threw)
  // Store the chain (void version) so next caller waits for us
  slotLocks.set(key, next.then(() => {}, () => {}));
  // Cleanup after completion to avoid memory leak
  next.finally(() => {
    // Only delete if we're still the last in chain
    if (slotLocks.get(key) === next.then(() => {}, () => {})) {
      slotLocks.delete(key);
    }
  });
  return next;
}

export default factories.createCoreController('api::appointment.appointment', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    // API Token requests (from signaling server) have ctx.state.auth.strategy === 'api-token'
    const isApiToken = ctx.state.auth?.strategy?.name === 'api-token';
    if (!user && !isApiToken) return ctx.forbidden('Not authenticated');

    const isAdmin = isApiToken || user?.role?.type === 'admin' || user?.userRole === 'admin';
    const populate = {
      doctor: { populate: ['specialization', 'photo'] },
      patient: { fields: ['id', 'fullName'] },
    } as any;
    const sort = (ctx.query?.sort as any) || ['dateTime:desc'];

    // Parse filters from query params
    const queryFilters = ctx.query?.filters as any;
    const roomIdFilter = queryFilters?.roomId?.$eq;

    // Build additional filters (passed through from query)
    let additionalFilters: any = {};
    if (roomIdFilter) {
      additionalFilters.roomId = roomIdFilter;
    }

    // Apply dateTime range filter (used by getBookedSlots to check slot availability)
    const dateTimeGte = queryFilters?.dateTime?.$gte;
    const dateTimeLte = queryFilters?.dateTime?.$lte;
    if (dateTimeGte || dateTimeLte) {
      additionalFilters.dateTime = {};
      if (dateTimeGte) additionalFilters.dateTime.$gte = dateTimeGte;
      if (dateTimeLte) additionalFilters.dateTime.$lte = dateTimeLte;
    }

    // Apply statuse (ne) filter
    const statuseNe = queryFilters?.statuse?.$ne;
    if (statuseNe) {
      additionalFilters.statuse = { $ne: statuseNe };
    }

    // Apply doctor filter (so patients only see bookings for the requested doctor)
    const doctorIdFilter = queryFilters?.doctor?.id?.$eq;
    if (doctorIdFilter) {
      additionalFilters.doctor = { id: doctorIdFilter };
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

        // Use ONLY documentId — avoids IDOR via numeric id cross-contamination
        const data = await strapi.documents('api::appointment.appointment').findMany({
          filters: { doctor: { documentId: doctorRecord.documentId }, ...additionalFilters },
          sort,
          populate,
        });
        return {
          data,
          meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
        };
      } else {
        // Фильтруем по patient (users-permissions user) — только по documentId
        const patientDocId = user.documentId;
        if (!patientDocId) {
          return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
        }
        const data = await strapi.documents('api::appointment.appointment').findMany({
          filters: { patient: { documentId: patientDocId }, ...additionalFilters },
          sort,
          populate,
        });
        return {
          data,
          meta: { pagination: { page: 1, pageSize: data.length, pageCount: 1, total: data.length } },
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
      patient: { fields: ['id', 'fullName'] },
      medical_documents: { populate: ['file'] },
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

    // --- Input validation ---
    if (!body.dateTime) return ctx.badRequest('dateTime is required');
    const parsedDate = new Date(body.dateTime);
    if (isNaN(parsedDate.getTime())) return ctx.badRequest('dateTime must be a valid ISO 8601 date');
    if (parsedDate <= new Date()) return ctx.badRequest('dateTime must be in the future');

    const ALLOWED_TYPES = ['video', 'chat'];
    const appointmentType = body.type || 'video';
    if (!ALLOWED_TYPES.includes(appointmentType)) return ctx.badRequest('type must be video or chat');

    if (!body.doctor) return ctx.badRequest('doctor is required');
    if (!body.roomId || typeof body.roomId !== 'string' || body.roomId.length > 128) {
      return ctx.badRequest('roomId is required and must be a valid string');
    }

    // --- Working hours validation (skip for admin) ---
    if (!isAdmin) {
      const drRef = body.doctor;
      const drForHours: any = typeof drRef === 'number'
        ? await strapi.query('api::doctor.doctor').findOne({ where: { id: drRef } })
        : await strapi.query('api::doctor.doctor').findOne({ where: { documentId: drRef } });

      if (drForHours) {
        // Check working day (workingDays = "1,2,3,4,5", Mon=1 Sun=7 per ISO)
        // Используем казахстанское время (UTC+5) для определения дня недели
        const kzDate = new Date(parsedDate.getTime() + 5 * 60 * 60 * 1000);
        const isoDay = kzDate.getUTCDay() === 0 ? 7 : kzDate.getUTCDay();
        const workingDays = (drForHours.workingDays || '1,2,3,4,5')
          .split(',').map((d: string) => parseInt(d.trim(), 10));
        if (!workingDays.includes(isoDay)) {
          return ctx.badRequest('Doctor does not work on the selected day');
        }

        // Check working hours — times stored as "HH:MM"
        // Используем UTC+5 (Астана/Алматы) для сравнения с рабочими часами врача
        const toMinutes = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        const KZ_OFFSET = 5 * 60; // UTC+5 в минутах
        const apptMinutes = (parsedDate.getUTCHours() * 60 + parsedDate.getUTCMinutes() + KZ_OFFSET) % 1440;
        const workStart = toMinutes(drForHours.workStartTime || '09:00');
        const workEnd   = toMinutes(drForHours.workEndTime   || '18:00');
        const breakStart = toMinutes(drForHours.breakStart    || '13:00');
        const breakEnd   = toMinutes(drForHours.breakEnd      || '14:00');

        if (apptMinutes < workStart || apptMinutes >= workEnd) {
          return ctx.badRequest('Appointment time is outside doctor working hours');
        }
        if (apptMinutes >= breakStart && apptMinutes < breakEnd) {
          return ctx.badRequest('Appointment time falls during doctor break time');
        }
      }
    }

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
    let doctorRecord: any;
    if (body.doctor) {
      if (typeof body.doctor === 'number') {
        doctorRecord = await strapi.query('api::doctor.doctor').findOne({ where: { id: body.doctor } });
        doctorDocId = doctorRecord?.documentId;
      } else {
        doctorDocId = body.doctor;
        doctorRecord = await strapi.query('api::doctor.doctor').findOne({ where: { documentId: body.doctor } });
      }
    }

    // --- Validate price against canonical doctor price ---
    if (!doctorRecord) {
      return ctx.badRequest('Doctor not found');
    }
    const actualPrice = Number(doctorRecord.price);
    const submittedPrice = Number(body.price);
    if (!submittedPrice || submittedPrice !== actualPrice) {
      return ctx.badRequest('Invalid appointment price');
    }

    // --- Restrict paymentStatus: only signaling server / admin may mark as paid ---
    const ALLOWED_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'in_progress'];
    const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
    const requestedStatus = body.statuse || body.status || 'pending';
    const requestedPaymentStatus = body.paymentStatus || 'pending';

    if (!ALLOWED_STATUSES.includes(requestedStatus)) {
      return ctx.badRequest('Invalid status value');
    }
    if (!ALLOWED_PAYMENT_STATUSES.includes(requestedPaymentStatus)) {
      return ctx.badRequest('Invalid paymentStatus value');
    }
    // Non-admin patients cannot self-assign paymentStatus='paid' with price=0
    if (!isAdmin && requestedPaymentStatus === 'paid' && actualPrice <= 0) {
      return ctx.badRequest('Invalid payment state');
    }

    // --- Atomic check + create using mutex (prevents race condition) ---
    const lockKey = `${doctorDocId}:${body.dateTime}`;

    const result = await withSlotLock(lockKey, async () => {
      if (body.dateTime && doctorDocId) {
        const requestedTime = new Date(body.dateTime);

        // Find doctor to get slotDuration
        const doctorRecord = await strapi.documents('api::doctor.doctor').findOne({
          documentId: doctorDocId,
          fields: ['id', 'slotDuration'],
        });
        const slotMinutes = (doctorRecord as any)?.slotDuration || 30;

        // Check for existing active appointments at the same time for this doctor
        const slotStart = new Date(requestedTime);
        const slotEnd = new Date(requestedTime.getTime() + slotMinutes * 60 * 1000);

        const existing = await strapi.documents('api::appointment.appointment').findMany({
          filters: {
            doctor: { documentId: doctorDocId },
            dateTime: {
              $gte: slotStart.toISOString(),
              $lt: slotEnd.toISOString(),
            },
            statuse: { $in: ['pending', 'confirmed', 'in_progress'] },
          },
        });

        if (existing.length > 0) {
          return { conflict: true };
        }
      }

      // Create appointment inside the lock — no one else can create for same slot
      const appointment = await strapi.documents('api::appointment.appointment').create({
        data: {
          dateTime: body.dateTime,
          type: body.type || 'video',
          statuse: requestedStatus,
          price: actualPrice,
          roomId: body.roomId,
          paymentStatus: requestedPaymentStatus,
          patient: patientDocId,
          doctor: doctorDocId,
        },
        status: 'published',
        populate: {
          doctor: { populate: ['specialization', 'photo'] },
          patient: { fields: ['id', 'fullName', 'email', 'phone'] },
        },
      });

      return { conflict: false, appointment };
    });

    if (result.conflict) {
      return ctx.badRequest('К сожалению, это время уже было забронировано другим пациентом. Пожалуйста, выберите другое свободное время.');
    }

    // Audit log — structured so it can be filtered/exported
    strapi.log.info(JSON.stringify({
      audit: 'APPOINTMENT_CREATED',
      appointmentId: result.appointment?.documentId,
      patientId: patientDocId,
      doctorId: doctorDocId,
      dateTime: body.dateTime,
      price: actualPrice,
      paymentStatus: requestedPaymentStatus,
      createdBy: user.id,
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));

    return { data: result.appointment };
  },

  /**
   * GET /appointments/can-join/:roomId
   * Возвращает авторитетное решение серверного времени:
   *   allowed, reason, serverTime, windowStart, windowEnd, dateTime.
   * Защищает от неверных часов/TZ на клиентском устройстве.
   */
  async canJoin(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Not authenticated');

    const { roomId } = ctx.params;
    if (!roomId || typeof roomId !== 'string') {
      return ctx.badRequest('roomId required');
    }

    const list = await strapi.documents('api::appointment.appointment').findMany({
      filters: { roomId },
      populate: {
        doctor: {
          fields: ['id', 'consultationDuration'],
          populate: { users_permissions_user: { fields: ['id'] } },
        },
        patient: { fields: ['id'] },
      },
    });

    const appointment = list?.[0];
    if (!appointment) return ctx.notFound('Appointment not found');

    const isAdmin = user.role?.type === 'admin' || user.userRole === 'admin';
    const isPatientParticipant = appointment.patient?.id === user.id;
    const isDoctorParticipant = appointment.doctor?.users_permissions_user?.id === user.id;

    if (!isAdmin && !isPatientParticipant && !isDoctorParticipant) {
      return ctx.forbidden('Not a participant of this appointment');
    }

    const now = new Date();
    const dateTime = appointment.dateTime ? new Date(appointment.dateTime) : null;
    if (!dateTime || isNaN(dateTime.getTime())) {
      return ctx.badRequest('Appointment has invalid dateTime');
    }

    const duration = Number((appointment.doctor as any)?.consultationDuration) || 30;
    const BUFFER_BEFORE_MS = 15 * 60 * 1000;
    const BUFFER_AFTER_MS = 5 * 60 * 1000;
    const windowStart = new Date(dateTime.getTime() - BUFFER_BEFORE_MS);
    const windowEnd = new Date(dateTime.getTime() + duration * 60 * 1000 + BUFFER_AFTER_MS);

    const allowedStatuses = ['pending', 'confirmed', 'in_progress'];
    const status = (appointment as any).statuse;

    let allowed = true;
    let reason: string | null = null;

    if (!allowedStatuses.includes(status)) {
      allowed = false;
      reason = status === 'cancelled' ? 'cancelled' : 'wrong_status';
    } else if (now < windowStart) {
      allowed = false;
      reason = 'too_early';
    } else if (now > windowEnd) {
      allowed = false;
      reason = 'too_late';
    }

    return {
      data: {
        allowed,
        reason,
        serverTime: now.toISOString(),
        dateTime: dateTime.toISOString(),
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        status,
        consultationDuration: duration,
      },
    };
  },
}));
