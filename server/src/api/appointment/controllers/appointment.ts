/**
 * Appointment controller с ownership-фильтрацией.
 * - Patient видит только свои appointments
 * - Doctor видит только свои appointments
 * - Admin видит всё
 */
import { factories } from '@strapi/strapi';
import { randomUUID } from 'crypto';
import { getPromotionPricing } from '../../../utils/promotions';

const ACTIVE_SLOT_STATUSES = ['pending', 'confirmed', 'in_progress'];
const ALLOWED_PATIENT_DOCUMENT_STATUSES = ['not_provided', 'will_upload_later', 'no_documents', 'uploaded'];
const DEFAULT_PAID_APPOINTMENT_CREATE_GRACE_MINUTES = 15;
const PAID_APPOINTMENT_CREATE_GRACE_MINUTES = (() => {
  const value = Number(process.env.PAID_APPOINTMENT_CREATE_GRACE_MINUTES);
  return Number.isFinite(value) && value >= 0
    ? value
    : DEFAULT_PAID_APPOINTMENT_CREATE_GRACE_MINUTES;
})();
const DEFAULT_PAYMENT_SLOT_HOLD_MINUTES = 30;
const PAYMENT_SLOT_HOLD_MINUTES = (() => {
  const value = Number(process.env.PAYMENT_SLOT_HOLD_MINUTES);
  return Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_PAYMENT_SLOT_HOLD_MINUTES;
})();

const getFrontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:1342').replace(/\/+$/, '');

const generateRoomId = () => `room-${randomUUID()}`;

const escapeHtml = (value: unknown) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatAppointmentDateTime = (value: unknown) => {
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return 'указанное время';

  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getDoctorUserForEmail = async (doctorDocId?: string) => {
  if (!doctorDocId) return null;

  const doctor = await strapi.query('api::doctor.doctor').findOne({
    where: { documentId: doctorDocId },
    populate: { users_permissions_user: true },
  });

  if (doctor?.users_permissions_user?.email) {
    return doctor.users_permissions_user;
  }

  if (doctor?.userId) {
    return strapi.query('plugin::users-permissions.user').findOne({
      where: { id: doctor.userId },
    });
  }

  return null;
};

const sendConsultationLinkEmails = async (appointment: any, doctorDocId?: string) => {
  if (!appointment || appointment.type !== 'video' || !appointment.roomId) return;

  try {
    const consultationUrl = `${getFrontendUrl()}/consultation/${encodeURIComponent(appointment.roomId)}`;
    const appointmentTime = formatAppointmentDateTime(appointment.dateTime);
    const doctorUser = await getDoctorUserForEmail(doctorDocId);
    const recipients = new Map<string, { name: string; role: 'patient' | 'doctor' }>();

    if (appointment.patient?.email) {
      recipients.set(String(appointment.patient.email).toLowerCase(), {
        name: appointment.patient.fullName || 'пациент',
        role: 'patient',
      });
    }

    if (doctorUser?.email) {
      recipients.set(String(doctorUser.email).toLowerCase(), {
        name: doctorUser.fullName || appointment.doctor?.fullName || 'доктор',
        role: 'doctor',
      });
    }

    for (const [email, recipient] of recipients) {
      const safeName = escapeHtml(recipient.name);
      const safeUrl = escapeHtml(consultationUrl);
      const roleText = recipient.role === 'doctor' ? 'доктора' : 'пациента';

      try {
        await strapi.plugin('email').service('email').send({
          to: email,
          subject: 'Ссылка на видеоконсультацию — MedConnect',
          text: [
            `Здравствуйте, ${recipient.name}!`,
            '',
            `Ваша видеоконсультация запланирована на ${appointmentTime}.`,
            `Ссылка для подключения: ${consultationUrl}`,
            '',
            'Если вы не авторизованы, сначала войдите в аккаунт. После входа вы автоматически вернетесь в консультацию.',
          ].join('\n'),
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#0d9488;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
                <h1 style="color:white;margin:0;font-size:24px;">MedConnect</h1>
              </div>
              <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
                <p style="color:#475569;margin-top:0;">Здравствуйте, ${safeName}!</p>
                <h2 style="color:#1e293b;margin:0 0 12px;">Видеоконсультация</h2>
                <p style="color:#475569;">Консультация для ${roleText} запланирована на <b>${escapeHtml(appointmentTime)}</b>.</p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${safeUrl}"
                     style="background:#0d9488;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                    Подключиться к консультации
                  </a>
                </div>
                <p style="color:#64748b;font-size:14px;">
                  Если вы не авторизованы, платформа сначала попросит войти в аккаунт, а затем автоматически вернет вас в консультацию.
                </p>
              </div>
            </div>
          `,
        });
      } catch (err) {
        strapi.log.error(`sendConsultationLinkEmail error for ${email}:`, err);
      }
    }
  } catch (err) {
    strapi.log.error('sendConsultationLinkEmails error:', err);
  }
};

const getActiveSlotKey = (doctorDocId: string | undefined, dateTime: string | undefined, status: string) => {
  if (!doctorDocId || !dateTime || !ACTIVE_SLOT_STATUSES.includes(status)) return null;
  return `${doctorDocId}:${new Date(dateTime).toISOString()}`;
};

const getPreparationData = (body: any) => {
  const data: Record<string, any> = {};

  if (body.patientDocumentsStatus !== undefined) {
    if (!ALLOWED_PATIENT_DOCUMENT_STATUSES.includes(body.patientDocumentsStatus)) {
      return { error: 'Invalid patientDocumentsStatus value' };
    }
    data.patientDocumentsStatus = body.patientDocumentsStatus;
  }

  if (body.doctorAccessGranted !== undefined) {
    data.doctorAccessGranted = Boolean(body.doctorAccessGranted);
  }

  if (body.preparationChecklist !== undefined) {
    if (
      body.preparationChecklist !== null &&
      (typeof body.preparationChecklist !== 'object' || Array.isArray(body.preparationChecklist))
    ) {
      return { error: 'preparationChecklist must be an object' };
    }
    data.preparationChecklist = body.preparationChecklist;
  }

  if (Object.keys(data).length > 0) {
    data.preparationUpdatedAt = new Date().toISOString();
  }

  return { data };
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

const combineFilters = (...filters: any[]) => {
  const activeFilters = filters.filter((filter) => filter && Object.keys(filter).length > 0);
  if (activeFilters.length === 0) return {};
  if (activeFilters.length === 1) return activeFilters[0];
  return { $and: activeFilters };
};

const timeToMinutes = (value: any) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const parseWorkingIntervals = (value: any) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeWorkingIntervals = (value: any) => parseWorkingIntervals(value)
  .map((interval: any) => ({
    start: interval?.start || interval?.startTime,
    end: interval?.end || interval?.endTime,
  }))
  .filter((interval: any) => {
    const start = timeToMinutes(interval.start);
    const end = timeToMinutes(interval.end);
    return start !== null && end !== null && start < end;
  })
  .sort((a: any, b: any) => (timeToMinutes(a.start) as number) - (timeToMinutes(b.start) as number));

const legacyWorkingHoursToIntervals = (doctor: any) => {
  const workStartTime = doctor?.workStartTime ?? '09:00';
  const workEndTime = doctor?.workEndTime ?? '18:00';
  const breakStart = doctor?.breakStart ?? '12:00';
  const breakEnd = doctor?.breakEnd ?? '14:00';
  const workStart = timeToMinutes(workStartTime);
  const workEnd = timeToMinutes(workEndTime);
  const pauseStart = timeToMinutes(breakStart);
  const pauseEnd = timeToMinutes(breakEnd);

  if (workStart === null || workEnd === null || workStart >= workEnd) {
    return [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }];
  }

  if (
    pauseStart === null ||
    pauseEnd === null ||
    pauseStart >= pauseEnd ||
    pauseStart <= workStart ||
    pauseEnd >= workEnd
  ) {
    return [{ start: workStartTime, end: workEndTime }];
  }

  return [
    { start: workStartTime, end: breakStart },
    { start: breakEnd, end: workEndTime },
  ].filter((interval) => (timeToMinutes(interval.start) as number) < (timeToMinutes(interval.end) as number));
};

const getDoctorWorkingIntervals = (doctor: any) => {
  const intervals = normalizeWorkingIntervals(doctor?.workingIntervals);
  return intervals.length > 0 ? intervals : legacyWorkingHoursToIntervals(doctor);
};

const paymentIntentHoldFilter = () => ({
  $or: [
    { status: 'paid' },
    {
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - PAYMENT_SLOT_HOLD_MINUTES * 60 * 1000).toISOString() },
    },
  ],
});

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

const requestAutomaticRefund = async (appointment: any, amount: number) => {
  const signalingUrl = process.env.SIGNALING_SERVER_URL || process.env.SIGNALING_API_URL;
  const internalSecret = process.env.SIGNALING_INTERNAL_SECRET;
  if (!signalingUrl || !internalSecret) {
    throw new Error('SIGNALING_SERVER_URL/SIGNALING_INTERNAL_SECRET are not configured');
  }
  if (!appointment?.paymentId) {
    throw new Error('appointment.paymentId is required for automatic refund');
  }

  const res = await fetch(`${signalingUrl.replace(/\/$/, '')}/api/payment/refund-appointment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': internalSecret,
    },
    body: JSON.stringify({
      appointmentId: appointment.documentId,
      paymentId: appointment.paymentId,
      amount,
    }),
  });

  const raw = await res.text().catch(() => '');
  let data: any = null;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }
  }
  if (!res.ok || data?.success !== true) {
    throw new Error(`Refund API HTTP ${res.status}: ${raw.slice(0, 500)}`);
  }
  return data;
};

// QA BUG-07: when an automatic refund fails the money is still with the gateway
// and a human must act. Notify every admin so it isn't lost in the logs.
const notifyAdminsRefundFailure = async (details: any) => {
  try {
    const admins = await strapi.query('plugin::users-permissions.user').findMany({
      where: { role: { type: 'admin' } },
      limit: 50,
    });
    const svc = strapi.service('api::notification.notification');
    for (const admin of admins) {
      await svc.notifyUser(admin.id, {
        title: 'Сбой автоматического возврата',
        message: `Не удалось вернуть оплату по записи ${details.documentId}. Требуется ручной возврат через кабинет ePay.`,
        type: 'system',
        link: '/admin/appointments',
        metadata: details,
      });
    }
  } catch (err) {
    strapi.log.error('notifyAdminsRefundFailure error:', err);
  }
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

    // Apply exact payment filter. This is used by the signaling server for
    // payment idempotency; ignoring it can make a paid booking look created
    // when any appointment exists.
    const paymentIdEq = queryFilters?.paymentId?.$eq;
    if (paymentIdEq) {
      additionalFilters.paymentId = String(paymentIdEq);
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

    // Apply patient filter (used by doctor's patient history page).
    const patientIdFilter = queryFilters?.patient?.id?.$eq;
    const patientDocumentIdFilter = queryFilters?.patient?.documentId?.$eq;
    if (patientIdFilter) {
      additionalFilters.patient = { id: patientIdFilter };
    } else if (patientDocumentIdFilter) {
      additionalFilters.patient = { documentId: patientDocumentIdFilter };
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
          filters: combineFilters({ doctor: { documentId: doctorRecord.documentId } }, additionalFilters),
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
          filters: combineFilters({ patient: { documentId: patientDocId } }, additionalFilters),
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
    const isApiToken = isApiTokenRequest(ctx);

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
    const now = new Date();
    const isPaidGatewayCreate = isApiToken &&
      body.paymentStatus === 'paid' &&
      typeof body.paymentId === 'string' &&
      body.paymentId.length > 0;
    const paidGatewayCreateDeadline = new Date(
      parsedDate.getTime() + PAID_APPOINTMENT_CREATE_GRACE_MINUTES * 60 * 1000
    );
    if (parsedDate <= now && (!isPaidGatewayCreate || now > paidGatewayCreateDeadline)) {
      return ctx.badRequest('dateTime must be in the future');
    }

    const ALLOWED_TYPES = ['video', 'chat'];
    const appointmentType = body.type || 'video';
    if (!ALLOWED_TYPES.includes(appointmentType)) return ctx.badRequest('type must be video or chat');

    if (!body.doctor) return ctx.badRequest('doctor is required');

    let roomId: string | undefined;
    if (body.roomId !== undefined) {
      if (typeof body.roomId !== 'string' || body.roomId.trim().length === 0 || body.roomId.length > 128) {
        return ctx.badRequest('roomId must be a valid string');
      }
      roomId = body.roomId;
    } else if (appointmentType === 'video') {
      roomId = generateRoomId();
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
          .split(',')
          .map((d: string) => parseInt(d.trim(), 10))
          .filter((day: number) => !Number.isNaN(day))
          .map((day: number) => day === 0 ? 7 : day);
        if (!workingDays.includes(isoDay)) {
          return ctx.badRequest('Doctor does not work on the selected day');
        }

        // Check working intervals - times stored as "HH:MM"
        // Используем UTC+5 (Астана/Алматы) для сравнения с рабочими часами врача
        const KZ_OFFSET = 5 * 60; // UTC+5 в минутах
        const apptMinutes = (parsedDate.getUTCHours() * 60 + parsedDate.getUTCMinutes() + KZ_OFFSET) % 1440;
        const slotMinutes = Number(drForHours.slotDuration) || 30;
        const appointmentEndMinutes = apptMinutes + slotMinutes;
        const workingIntervals = getDoctorWorkingIntervals(drForHours);
        const isInsideWorkingInterval = workingIntervals.some((interval: any) => {
          const start = timeToMinutes(interval.start);
          const end = timeToMinutes(interval.end);
          return start !== null &&
            end !== null &&
            apptMinutes >= start &&
            appointmentEndMinutes <= end;
        });

        if (!isInsideWorkingInterval) {
          return ctx.badRequest('Appointment time is outside doctor working hours');
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
        doctorRecord = await strapi.query('api::doctor.doctor').findOne({
          where: { id: body.doctor },
          populate: { specialization: true },
        });
        doctorDocId = doctorRecord?.documentId;
      } else {
        doctorDocId = body.doctor;
        doctorRecord = await strapi.query('api::doctor.doctor').findOne({
          where: { documentId: body.doctor },
          populate: { specialization: true },
        });
      }
    }

    // --- Validate price against canonical doctor price ---
    if (!doctorRecord) {
      return ctx.badRequest('Doctor not found');
    }
    const pricing = await getPromotionPricing(strapi, doctorRecord);
    const actualPrice = Number(pricing.effectivePrice);
    const submittedPrice = Number(body.price);
    // For a paid gateway create the price was locked when the payment intent was
    // created and the patient has already been charged that amount. If the doctor
    // changed their price mid-flow, re-validating against the *current* price would
    // reject the booking and strand a captured payment (QA BUG-05), so we trust the
    // locked, already-paid amount here and only require it to be a positive number.
    if (!submittedPrice || (!isPaidGatewayCreate && submittedPrice !== actualPrice)) {
      return ctx.badRequest('Invalid appointment price');
    }
    const priceToStore = isPaidGatewayCreate ? submittedPrice : actualPrice;
    const submittedOriginalPrice = Number(body.originalPrice);
    const originalPriceToStore = isPaidGatewayCreate && Number.isFinite(submittedOriginalPrice) && submittedOriginalPrice >= priceToStore
      ? submittedOriginalPrice
      : Number(pricing.originalPrice || doctorRecord.price || priceToStore);
    const discountAmountToStore = Math.max(0, originalPriceToStore - priceToStore);
    const gatewayPromotionSnapshot =
      isPaidGatewayCreate && body.promotionSnapshot && typeof body.promotionSnapshot === 'object'
        ? body.promotionSnapshot
        : null;
    const promotionSnapshot = discountAmountToStore > 0
      ? {
          ...(gatewayPromotionSnapshot || pricing.activePromotion || {}),
          originalPrice: originalPriceToStore,
          effectivePrice: priceToStore,
          discountAmount: discountAmountToStore,
          discountPercent: gatewayPromotionSnapshot?.discountPercent || pricing.discountPercent,
          appliedAt: gatewayPromotionSnapshot?.appliedAt || new Date().toISOString(),
        }
      : null;

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
      const preparation = getPreparationData(body);
      if (preparation.error) return { validationError: preparation.error };
      const appointment = await strapi.documents('api::appointment.appointment').create({
        data: {
          dateTime: body.dateTime,
          type: body.type || 'video',
          statuse: requestedStatus,
          price: priceToStore,
          originalPrice: originalPriceToStore,
          discountAmount: discountAmountToStore,
          ...(promotionSnapshot ? { promotionSnapshot } : {}),
          ...(roomId ? { roomId } : {}),
          paymentStatus: requestedPaymentStatus,
          ...(body.paymentId ? { paymentId: body.paymentId } : {}),
          ...(activeSlotKey ? { activeSlotKey } : {}),
          ...(preparation.data || {}),
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

    if ((result as any).validationError) {
      return ctx.badRequest((result as any).validationError);
    }

    if (result.conflict) {
      // Tag the response so the payment gateway can reliably tell a slot conflict
      // apart from other 400s and trigger an automatic refund (QA BUG-05).
      return ctx.badRequest(
        'К сожалению, это время уже было забронировано другим пациентом. Пожалуйста, выберите другое свободное время.',
        { code: 'SLOT_CONFLICT' }
      );
    }

    // Audit log — structured so it can be filtered/exported
    strapi.log.info(JSON.stringify({
      audit: 'APPOINTMENT_CREATED',
      appointmentId: result.appointment?.documentId,
      patientId: patientDocId,
      doctorId: doctorDocId,
      dateTime: body.dateTime,
      price: priceToStore,
      originalPrice: originalPriceToStore,
      discountAmount: discountAmountToStore,
      promotionId: promotionSnapshot?.documentId || null,
      paymentStatus: requestedPaymentStatus,
      createdBy: user?.id ?? 'api-token',
      ip: ctx.request.ip,
      ts: new Date().toISOString(),
    }));

    await sendConsultationLinkEmails(result.appointment, doctorDocId);

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

    // Shared refund path used by patient, doctor AND admin cancellations.
    // Issues the gateway refund, flips paymentStatus to 'refunded', and on
    // failure alerts admins (QA BUG-02 / BUG-07). Returns the refreshed doc or null.
    const performRefundForCancellation = async (appt: any, docId: string, amount: number) => {
      try {
        const refund = await requestAutomaticRefund({ ...appt, documentId: docId }, amount);
        const refreshed = await strapi.documents('api::appointment.appointment').update({
          documentId: docId,
          data: { paymentStatus: 'refunded' },
          status: 'published',
        });
        strapi.log.info(JSON.stringify({
          audit: 'APPOINTMENT_REFUNDED',
          documentId: docId,
          paymentId: appt.paymentId,
          amount,
          refund,
          ts: new Date().toISOString(),
        }));
        return refreshed;
      } catch (err: any) {
        strapi.log.error(JSON.stringify({
          audit: 'APPOINTMENT_REFUND_FAILED',
          documentId: docId,
          paymentId: appt.paymentId,
          amount,
          error: err?.message || String(err),
          ts: new Date().toISOString(),
        }));
        await notifyAdminsRefundFailure({
          documentId: docId,
          paymentId: appt.paymentId,
          amount,
          error: err?.message || String(err),
        });
        return null;
      }
    };

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

      // Admin-initiated cancellation of a paid appointment must refund the
      // patient in full (QA BUG-02), unless the admin set the status manually.
      const wasPaid = (current as any)?.paymentStatus === 'paid';
      if (
        process.env.PAYMENTS_LIVE === 'true' &&
        wasPaid &&
        nextStatus === 'cancelled' &&
        body.paymentStatus !== 'refunded'
      ) {
        const refreshed = await performRefundForCancellation(
          { ...(current as any), documentId },
          documentId,
          Number((current as any)?.price || 0),
        );
        return { data: refreshed || updated };
      }

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
    let shouldRequestRefund = false;
    let refundAmount = 0;

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
        if (process.env.PAYMENTS_LIVE === 'true' && (appointment as any).paymentStatus === 'paid') {
          const hoursUntil = (appointmentTime.getTime() - Date.now()) / (1000 * 60 * 60);
          if (hoursUntil >= CANCEL_REFUND_CUTOFF_HOURS) {
            shouldRequestRefund = true;
            refundAmount = Number((appointment as any).price || 0);
          }
        }
      }

      if (body.rating !== undefined || body.review !== undefined) {
        if ((appointment as any).statuse !== 'completed') {
          return ctx.badRequest('Rating and review can only be set after a completed consultation');
        }
        if (body.rating !== undefined) allowed.rating = body.rating;
        if (body.review !== undefined) allowed.review = body.review;
      }

      const preparation = getPreparationData(body);
      if (preparation.error) return ctx.badRequest(preparation.error);
      allowed = {
        ...allowed,
        ...(preparation.data || {}),
      };
    } else if (isDoctorParticipant || isDoctor) {
      // Doctors may advance/update status and write chatLog
      const DOCTOR_ALLOWED_STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled'];
      if (body.statuse !== undefined) {
        if (!DOCTOR_ALLOWED_STATUSES.includes(body.statuse)) {
          return ctx.badRequest('Invalid status transition');
        }
        allowed.statuse = body.statuse;

        // Doctor/clinic-initiated cancellation always refunds the patient in full,
        // regardless of the 24h cutoff — it isn't the patient's fault (QA BUG-02).
        if (
          body.statuse === 'cancelled' &&
          process.env.PAYMENTS_LIVE === 'true' &&
          (appointment as any).paymentStatus === 'paid'
        ) {
          shouldRequestRefund = true;
          refundAmount = Number((appointment as any).price || 0);
        }
      }
      if (body.chatLog !== undefined) allowed.chatLog = body.chatLog;
    }

    if (Object.keys(allowed).length === 0) {
      return ctx.badRequest('No allowed fields to update');
    }

    let updated = await strapi.documents('api::appointment.appointment').update({
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

    if (shouldRequestRefund) {
      const refreshed = await performRefundForCancellation(
        { ...(appointment as any), documentId },
        documentId,
        refundAmount,
      );
      if (refreshed) updated = refreshed;
    }

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

    const heldPaymentIntents = await strapi.documents('api::payment-intent.payment-intent').findMany({
      filters: {
        doctor: { documentId: doctorDocId },
        dateTime: { $gte: rangeStart.toISOString(), $lte: rangeEnd.toISOString() },
        ...paymentIntentHoldFilter(),
      } as any,
      fields: ['dateTime'],
      limit: 500,
    });

    for (const row of heldPaymentIntents as any[]) {
      if (!row?.dateTime) continue;
      const kz = new Date(new Date(row.dateTime).getTime() + KZ_OFFSET_MS);
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
    const isApiToken = isApiTokenRequest(ctx);
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

    if (rows.length > 0) {
      return { data: { available: false, conflicts: rows.length } };
    }

    const heldPaymentIntents = await strapi.documents('api::payment-intent.payment-intent').findMany({
      filters: {
        doctor: { documentId: doctorDocId },
        dateTime: {
          $gte: slotStart.toISOString(),
          $lt: slotEnd.toISOString(),
        },
        ...paymentIntentHoldFilter(),
      } as any,
      fields: ['id'],
      limit: 1,
    });

    return { data: { available: heldPaymentIntents.length === 0, conflicts: heldPaymentIntents.length } };
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
