/**
 * Appointment controller с ownership-фильтрацией.
 * - Patient видит только свои appointments
 * - Doctor видит только свои appointments
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';

const ACTIVE_SLOT_STATUSES = ['pending', 'confirmed', 'in_progress'];

const getActiveSlotKey = (doctorDocId: string | undefined, dateTime: string | undefined, status: string) => {
  if (!doctorDocId || !dateTime || !ACTIVE_SLOT_STATUSES.includes(status)) return null;
  return `${doctorDocId}:${new Date(dateTime).toISOString()}`;
};

const isApiTokenRequest = (ctx: any) => {
  const authState = ctx.state?.auth;
  return (
    authState?.strategy?.name === 'api-token' ||
    authState?.credentials?.type === 'api-token' ||
    (!ctx.state?.user && Boolean(authState?.credentials) && String(ctx.request?.headers?.authorization || '').startsWith('Bearer '))
  );
};

const normalizeFilterList = (value: any) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
  return value ? [value] : [];
};

const getBearerToken = (ctx: any) => {
  const header = String(ctx.request?.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7) : null;
};

const getUserFromJwt = async (ctx: any) => {
  const token = getBearerToken(ctx);
  if (!token) return null;

  try {
    const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
    if (!payload?.id) return null;
    return strapi.query('plugin::users-permissions.user').findOne({ where: { id: payload.id } });
  } catch {
    return null;
  }
};

const isInternalSlotRequest = (ctx: any) => {
  const configuredSecret = process.env.SIGNALING_INTERNAL_SECRET;
  if (!configuredSecret) return false;
  return String(ctx.request?.headers?.['x-internal-secret'] || '') === configuredSecret;
};

// ── Slot mutex: prevents two concurrent creates for the same doctor+time ──
const slotLocks = new Map<string, Promise<void>>();

function withSlotLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = slotLocks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn); // run fn after previous finishes (even if it threw)
  // Store the void chain so the next caller can wait for us.
  // IMPORTANT: capture voidNext in a variable — every .then() call creates a
  // NEW Promise object, so comparing slotLocks.get(key) === next.then(...)
  // inside finally() would always be false (different object reference) and
  // the key would never be deleted (memory leak).
  const voidNext = next.then(() => {}, () => {});
  slotLocks.set(key, voidNext);
  next.finally(() => {
    if (slotLocks.get(key) === voidNext) {
      slotLocks.delete(key);
    }
  });
  return next;
}

export default factories.createCoreController('api::appointment.appointment', () => ({
  async find(ctx) {
    const user = ctx.state.user;
    const isApiToken = isApiTokenRequest(ctx);
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
    const dateTimeLt = queryFilters?.dateTime?.$lt;
    const dateTimeLte = queryFilters?.dateTime?.$lte;
    if (dateTimeGte || dateTimeLt || dateTimeLte) {
      additionalFilters.dateTime = {};
      if (dateTimeGte) additionalFilters.dateTime.$gte = dateTimeGte;
      if (dateTimeLt) additionalFilters.dateTime.$lt = dateTimeLt;
      if (dateTimeLte) additionalFilters.dateTime.$lte = dateTimeLte;
    }

    // Apply statuse filters
    const statuseNe = queryFilters?.statuse?.$ne;
    const statuseIn = normalizeFilterList(queryFilters?.statuse?.$in);
    if (statuseNe) {
      additionalFilters.statuse = { $ne: statuseNe };
    } else if (statuseIn.length > 0) {
      additionalFilters.statuse = { $in: statuseIn };
    }

    // Apply doctor filter (so patients only see bookings for the requested doctor)
    const doctorIdFilter = queryFilters?.doctor?.id?.$eq;
    const doctorDocumentIdFilter = queryFilters?.doctor?.documentId?.$eq;
    if (doctorIdFilter) {
      const doctorRecord = await strapi.query('api::doctor.doctor').findOne({ where: { id: Number(doctorIdFilter) } });
      if (!doctorRecord?.documentId) {
        return { data: [], meta: { pagination: { page: 1, pageSize: 0, pageCount: 0, total: 0 } } };
      }
      additionalFilters.doctor = { documentId: doctorRecord.documentId };
    } else if (doctorDocumentIdFilter) {
      additionalFilters.doctor = { documentId: doctorDocumentIdFilter };
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
    // Requests from the signaling server arrive with an API token (no user session).
    // Treat them as trusted server-side calls, equivalent to admin for permission purposes.
    const isApiToken = (ctx.state as any)?.auth?.strategy?.name === 'api-token';

    if (!user && !isApiToken) return ctx.forbidden('Not authenticated');

    const isPatient = !isApiToken && (user.role?.type === 'patient' || user.userRole === 'patient');
    const isAdmin = isApiToken || user?.role?.type === 'admin' || user?.userRole === 'admin';
    const isHumanAdmin = user?.role?.type === 'admin' || user?.userRole === 'admin';

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
    if (!patientDocId) return ctx.badRequest('patient is required');

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
    if (body.paymentId !== undefined && typeof body.paymentId !== 'string') {
      return ctx.badRequest('paymentId must be a string');
    }
    // In live-payment mode, only the signaling server (api-token) or an admin
    // may create an appointment with paymentStatus='paid'. A regular patient
    // sending paymentStatus='paid' directly would bypass the payment gateway.
    // In test mode (PAYMENTS_LIVE !== 'true') we allow it so the test-payment
    // flow in the frontend works without a real payment provider.
    const isPaymentsLive = process.env.PAYMENTS_LIVE === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && !isPaymentsLive && (isApiToken || isPatient)) {
      return ctx.badRequest('Live payments must be enabled before appointments can be created in production');
    }

    if (!isHumanAdmin && !isApiToken && isPatient && isPaymentsLive) {
      return ctx.badRequest('Appointments must be created through the payment gateway');
    }

    if (isPaymentsLive && !isAdmin && requestedPaymentStatus === 'paid') {
      return ctx.badRequest('Payment must be confirmed through the payment gateway');
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

        // Filter by documentId (same for draft + published) so this works
        // with Strapi v5's default draft-biased findMany. Keeping it on drafts
        // also means cancelled bookings (default update writes to draft) are
        // treated as free, letting the slot be re-booked.
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
      const activeSlotKey = getActiveSlotKey(doctorDocId, body.dateTime, requestedStatus);
      const appointment = await strapi.documents('api::appointment.appointment').create({
        data: {
          dateTime: body.dateTime,
          type: body.type || 'video',
          statuse: requestedStatus,
          price: actualPrice,
          roomId: body.roomId,
          paymentStatus: requestedPaymentStatus,
          ...(body.paymentId ? { paymentId: body.paymentId } : {}),
          ...(activeSlotKey ? { activeSlotKey } : {}),
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
      createdBy: user?.id ?? 'api-token',
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));

    return { data: result.appointment };
  },

  async update(ctx) {
    const user = ctx.state.user;
    const authState = (ctx.state as any)?.auth;
    const isApiToken =
      authState?.strategy?.name === 'api-token' ||
      authState?.credentials?.type === 'api-token' ||
      (!user && Boolean(authState?.credentials) && String(ctx.request?.headers?.authorization || '').startsWith('Bearer '));
    if (!user && !isApiToken) return ctx.forbidden('Not authenticated');

    const isAdmin = isApiToken || user?.role?.type === 'admin' || user?.userRole === 'admin';
    const isDoctor = user?.role?.type === 'doctor' || user?.userRole === 'doctor';

    const { id: documentId } = ctx.params;
    const body = (ctx.request.body as any)?.data || ctx.request.body || {};

    // Admins bypass field restrictions
    if (isAdmin) {
      const current = await strapi.documents('api::appointment.appointment').findOne({
        documentId,
        populate: { doctor: { fields: ['documentId'] } },
      });
      const nextStatus = body.statuse || body.status || (current as any)?.statuse;
      const nextDateTime = body.dateTime || (current as any)?.dateTime;
      const doctorDocId = body.doctor || (current as any)?.doctor?.documentId;
      const activeSlotKey = getActiveSlotKey(
        typeof doctorDocId === 'string' ? doctorDocId : undefined,
        nextDateTime,
        nextStatus,
      );
      const data = {
        ...body,
        activeSlotKey,
      };
      const updated = await strapi.documents('api::appointment.appointment').update({
        documentId,
        data,
        status: 'published',
      });
      return { data: updated };
    }

    // Verify participant (policy also runs, this is defence-in-depth)
    const appointment = await strapi.documents('api::appointment.appointment').findOne({
      documentId,
      populate: {
        patient: { fields: ['id'] },
        doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
      },
    });
    if (!appointment) return ctx.notFound('Appointment not found');

    const isPatient = appointment.patient?.id === user.id;
    const isDoctorParticipant = appointment.doctor?.users_permissions_user?.id === user.id;

    if (!isPatient && !isDoctorParticipant) return ctx.forbidden('Not a participant');

    // --- Field allowlists by role ---
    let allowed: Record<string, any> = {};

    const CANCEL_REFUND_CUTOFF_HOURS = 24;

    if (isPatient) {
      if (body.statuse !== undefined) {
        if (body.statuse !== 'cancelled') {
          return ctx.badRequest('Patients can only cancel appointments');
        }

        const appointmentTime = new Date((appointment as any).dateTime);
        if (appointmentTime <= new Date()) {
          return ctx.badRequest('Cannot cancel a past appointment');
        }

        allowed.statuse = 'cancelled';

        // Refund only if cancelled more than CANCEL_REFUND_CUTOFF_HOURS before appointment
        if ((appointment as any).paymentStatus === 'paid') {
          const hoursUntil = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60);
          allowed.paymentStatus = hoursUntil >= CANCEL_REFUND_CUTOFF_HOURS ? 'refunded' : 'paid';
        }
      }

      if (body.rating !== undefined || body.review !== undefined) {
        if ((appointment as any).statuse !== 'completed') {
          return ctx.badRequest('Rating and review can only be set after a completed consultation');
        }
        if (body.rating !== undefined) allowed.rating = body.rating;
        if (body.review !== undefined) allowed.review = body.review;
      }
    } else if (isDoctorParticipant || isDoctor) {
      // Doctors may advance/update status and write chatLog
      const DOCTOR_ALLOWED_STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled'];
      if (body.statuse !== undefined) {
        if (!DOCTOR_ALLOWED_STATUSES.includes(body.statuse)) {
          return ctx.badRequest('Invalid status transition');
        }
        allowed.statuse = body.statuse;
      }
      if (body.chatLog !== undefined) allowed.chatLog = body.chatLog;
    }

    if (Object.keys(allowed).length === 0) {
      return ctx.badRequest('No allowed fields to update');
    }

    const updated = await strapi.documents('api::appointment.appointment').update({
      documentId,
      data: {
        ...allowed,
        ...(allowed.statuse
          ? {
              activeSlotKey: getActiveSlotKey(
                (appointment as any).doctor?.documentId,
                (appointment as any).dateTime,
                allowed.statuse,
              ),
            }
          : {}),
      } as any,
      status: 'published',
    });

    strapi.log.info(JSON.stringify({
      audit: 'APPOINTMENT_UPDATED',
      documentId,
      fields: Object.keys(allowed),
      updatedBy: user.id,
      role: isPatient ? 'patient' : 'doctor',
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));

    return { data: updated };
  },

  /**
   * GET /appointments/booked-slots/:doctorId?date=YYYY-MM-DD
   * Возвращает массив занятых времён ["HH:mm"] в часовом поясе Казахстана
   * (UTC+5) для указанного врача и даты. Обходит ownership-фильтр find(),
   * но НЕ возвращает никаких данных пациентов — только строки времени.
   * Используется UI записи чтобы не показывать забронированные слоты.
   */
  async findBookedSlots(ctx) {
    const user = ctx.state.user;
    if (!user) return ctx.unauthorized('Not authenticated');

    const { doctorId } = ctx.params;
    const date = ctx.query?.date as string | undefined;

    if (!doctorId) return ctx.badRequest('doctorId required');
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return ctx.badRequest('date is required (YYYY-MM-DD)');
    }

    // Диапазон суток в UTC с запасом, чтобы покрыть записи, которые по UTC
    // попадают в соседние сутки при KZ +5 (19:00 UTC = 00:00 KZ+1д).
    const startUtc = new Date(`${date}T00:00:00.000Z`);
    const endUtc = new Date(`${date}T23:59:59.999Z`);
    const rangeStart = new Date(startUtc.getTime() - 6 * 60 * 60 * 1000);
    const rangeEnd = new Date(endUtc.getTime() + 6 * 60 * 60 * 1000);

    // Фронт обычно шлёт numeric id (published version of the doctor). In
    // Strapi v5 each document has a draft row and a published row with
    // DIFFERENT numeric ids, and the draft appointment links to the draft
    // doctor (not the published one). findMany defaults to drafts, so filtering
    // drafts by the published doctor's numeric id silently returns nothing.
    // Resolve to documentId (shared across draft+published) before querying.
    let doctorDocId: string | undefined;
    if (/^\d+$/.test(String(doctorId))) {
      const d = await strapi.query('api::doctor.doctor').findOne({ where: { id: Number(doctorId) } });
      doctorDocId = d?.documentId;
    } else {
      doctorDocId = String(doctorId);
    }
    if (!doctorDocId) {
      return { data: { slots: [] } };
    }

    const rows = await strapi.documents('api::appointment.appointment').findMany({
      filters: {
        doctor: { documentId: doctorDocId },
        dateTime: { $gte: rangeStart.toISOString(), $lte: rangeEnd.toISOString() },
        statuse: { $ne: 'cancelled' },
      },
      fields: ['dateTime'],
      limit: 500,
    });

    const KZ_OFFSET_MS = 5 * 60 * 60 * 1000;
    const slots = new Set<string>();
    for (const row of rows as any[]) {
      if (!row?.dateTime) continue;
      const kz = new Date(new Date(row.dateTime).getTime() + KZ_OFFSET_MS);
      // Оставляем только слоты, попадающие на запрошенную KZ-дату
      const y = kz.getUTCFullYear();
      const m = String(kz.getUTCMonth() + 1).padStart(2, '0');
      const d = String(kz.getUTCDate()).padStart(2, '0');
      if (`${y}-${m}-${d}` !== date) continue;
      const h = String(kz.getUTCHours()).padStart(2, '0');
      const min = String(kz.getUTCMinutes()).padStart(2, '0');
      slots.add(`${h}:${min}`);
    }

    return { data: { slots: Array.from(slots).sort() } };
  },

  /**
   * GET /appointments/slot-conflicts/check?doctorId=...&start=ISO&end=ISO
   * Called by signaling-server with a Strapi API token (bypasses users-permissions
   * policy). Also accepts a user JWT for direct patient calls.
   */
  async findSlotConflicts(ctx) {
    const authState = (ctx.state as any)?.auth;
    const isApiToken =
      authState?.strategy?.name === 'api-token' ||
      authState?.credentials?.type === 'api-token';
    const isInternal = isApiToken || isInternalSlotRequest(ctx);
    const user = isInternal ? null : await getUserFromJwt(ctx);
    if (!isInternal && !user) return ctx.unauthorized('Not authenticated');

    const doctorId = String(ctx.query?.doctorId || '');
    const start = String(ctx.query?.start || '');
    const end = String(ctx.query?.end || '');

    if (!doctorId) return ctx.badRequest('doctorId required');

    const slotStart = new Date(start);
    const slotEnd = new Date(end);
    if (
      Number.isNaN(slotStart.getTime()) ||
      Number.isNaN(slotEnd.getTime()) ||
      slotEnd <= slotStart
    ) {
      return ctx.badRequest('start and end must be valid ISO dates');
    }

    let doctorDocId: string | undefined;
    if (/^\d+$/.test(doctorId)) {
      const doctor = await strapi.query('api::doctor.doctor').findOne({ where: { id: Number(doctorId) } });
      doctorDocId = doctor?.documentId;
    } else {
      doctorDocId = doctorId;
    }

    if (!doctorDocId) {
      return { data: { available: true, conflicts: 0 } };
    }

    const rows = await strapi.documents('api::appointment.appointment').findMany({
      filters: {
        doctor: { documentId: doctorDocId },
        dateTime: {
          $gte: slotStart.toISOString(),
          $lt: slotEnd.toISOString(),
        },
        statuse: { $in: ACTIVE_SLOT_STATUSES as any },
      },
      fields: ['id'],
      limit: 1,
    });

    return { data: { available: rows.length === 0, conflicts: rows.length } };
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
