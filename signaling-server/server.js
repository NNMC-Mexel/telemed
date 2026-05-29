require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const crypto = require('crypto')

const app = express()
const server = http.createServer(app)
app.set('trust proxy', 1)

// CORS настройки
// Production: medconnect.nnmc.kz (frontend)
// Development: localhost ports
const getCorsOrigin = () => {
  if (process.env.NODE_ENV === 'production') {
    return [
      'https://medconnect.nnmc.kz',
      'https://www.medconnect.nnmc.kz',
    ];
  }
  // In development allow any localhost origin (Vite may use any port)
  return (origin, callback) => {
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
};

const corsOptions = {
  origin: getCorsOrigin(),
  methods: ['GET', 'POST'],
  credentials: true,
}

app.use(cors(corsOptions))
app.use(express.json({
  limit: '1mb',
  // Save raw body buffer so HMAC webhook signatures can be verified
  verify: (req, _res, buf) => { req.rawBody = buf },
}))

// =====================================================
// Startup validation — fail fast if required env vars are missing
// =====================================================
const REQUIRED_ENV_VARS = [
  'STRAPI_API_URL', 'STRAPI_API_TOKEN',
]
const PAYMENT_ENV_VARS = [
  'EPAY_CLIENT_ID', 'EPAY_CLIENT_SECRET', 'EPAY_TERMINAL_ID',
  'EPAY_QR_CLIENT_ID', 'EPAY_QR_CLIENT_SECRET', 'EPAY_QR_TERMINAL_ID',
  'EPAY_TILDA_SECRET',
]
const missingRequired = REQUIRED_ENV_VARS.filter((v) => !process.env[v])
if (missingRequired.length > 0) {
  console.error(`[STARTUP] Missing required environment variables: ${missingRequired.join(', ')}`)
  process.exit(1)
}
const missingPayment = PAYMENT_ENV_VARS.filter((v) => !process.env[v])
if (missingPayment.length > 0) {
  console.warn(`[STARTUP] Missing ePay variables (live payments disabled): ${missingPayment.join(', ')}`)
}
const PAYMENTS_LIVE = process.env.PAYMENTS_LIVE === 'true'
if (process.env.NODE_ENV === 'production' && !PAYMENTS_LIVE) {
  // Warn but don't crash — server runs in test-payment mode, live payment endpoints return 503
  console.warn('[STARTUP] PAYMENTS_LIVE is not set to true. Running in test-payment mode (live payment endpoints disabled).')
}
if (PAYMENTS_LIVE && missingPayment.length > 0) {
  console.error(`[STARTUP] Missing ePay variables while PAYMENTS_LIVE=true: ${missingPayment.join(', ')}`)
  process.exit(1)
}

// =====================================================
// ePay (Halyk Bank) Payment Integration
// =====================================================
const EPAY_CLIENT_ID = process.env.EPAY_CLIENT_ID
const EPAY_CLIENT_SECRET = process.env.EPAY_CLIENT_SECRET
const EPAY_TERMINAL_ID = process.env.EPAY_TERMINAL_ID
const IS_EPAY_TEST = process.env.EPAY_TEST !== 'false'

// QR-specific credentials (different terminal with pay_qr_local enabled)
const EPAY_QR_CLIENT_ID = process.env.EPAY_QR_CLIENT_ID
const EPAY_QR_CLIENT_SECRET = process.env.EPAY_QR_CLIENT_SECRET
const EPAY_QR_TERMINAL_ID = process.env.EPAY_QR_TERMINAL_ID

// TildaSecret — used to verify HMAC-SHA512 signatures on ePay postLink callbacks
const EPAY_TILDA_SECRET = process.env.EPAY_TILDA_SECRET

const EPAY_OAUTH_URL = IS_EPAY_TEST
  ? 'https://test-epay-oauth.epayment.kz/oauth2/token'
  : 'https://epay-oauth.homebank.kz/oauth2/token'

const EPAY_WIDGET_URL = IS_EPAY_TEST
  ? 'https://test-epay.epayment.kz/payform/payment-api.js'
  : 'https://epay.homebank.kz/payform/payment-api.js'

// Official ePay QR API endpoints
const EPAY_QR_GENERATE_URL = IS_EPAY_TEST
  ? 'https://test-epay-api.epayment.kz/payment/qr/generate'
  : 'https://epay-api.homebank.kz/payment/qr/generate'

const EPAY_QR_STATUS_URL = IS_EPAY_TEST
  ? 'https://test-epay-api.epayment.kz/qr'
  : 'https://epay-api.homebank.kz/qr'

// Card payment transaction status (non-QR)
const EPAY_TRANSACTION_STATUS_URL = IS_EPAY_TEST
  ? 'https://test-epay-api.epayment.kz/payment/transactions'
  : 'https://epay-api.homebank.kz/payment/transactions'

const STRAPI_API_URL = process.env.STRAPI_API_URL

function getBearerToken(req) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) return header.slice(7)
  if (typeof req.body?.userToken === 'string' && req.body.userToken.trim()) {
    return req.body.userToken.trim()
  }
  return null
}

async function verifyHttpUserToken(token) {
  if (!token) return null
  const res = await fetch(`${STRAPI_API_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)
  if (!res?.ok) return null
  const user = await res.json().catch(() => null)
  return user?.id ? user : null
}

async function fetchExistingAppointmentByPaymentId(paymentId) {
  if (!paymentId) return null
  const res = await fetch(
    `${STRAPI_API_URL}/api/appointments?filters[paymentId][$eq]=${encodeURIComponent(paymentId)}&fields[0]=id&fields[1]=documentId&pagination[pageSize]=1`,
    { headers: { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN || ''}` } }
  ).catch(() => null)
  if (!res?.ok) return null
  const json = await res.json().catch(() => null)
  return json?.data?.[0] || null
}

const strapiServerHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.STRAPI_API_TOKEN || ''}`,
})

async function createPaymentIntent(data) {
  const res = await fetch(`${STRAPI_API_URL}/api/payment-intents`, {
    method: 'POST',
    headers: strapiServerHeaders(),
    body: JSON.stringify({ data }),
  })
  if (res.ok) return (await res.json()).data
  if (res.status !== 400 && res.status !== 409) {
    throw new Error(`PaymentIntent create HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }
  return null
}

async function findPaymentIntent(filterName, value) {
  if (!value) return null
  const query =
    `${STRAPI_API_URL}/api/payment-intents?filters[${filterName}][$eq]=${encodeURIComponent(value)}` +
    '&populate[patient][fields][0]=id' +
    '&populate[doctor][fields][0]=id' +
    '&populate[doctor][fields][1]=documentId' +
    '&populate[appointment][fields][0]=documentId' +
    '&pagination[pageSize]=1'
  const res = await fetch(query, { headers: strapiServerHeaders() }).catch(() => null)
  if (!res?.ok) return null
  const json = await res.json().catch(() => null)
  return json?.data?.[0] || null
}

async function updatePaymentIntent(documentId, data) {
  if (!documentId) return null
  const res = await fetch(`${STRAPI_API_URL}/api/payment-intents/${documentId}`, {
    method: 'PUT',
    headers: strapiServerHeaders(),
    body: JSON.stringify({ data }),
  }).catch(() => null)
  if (!res?.ok) return null
  return (await res.json().catch(() => null))?.data || null
}

function normalizePersistedIntent(intent) {
  if (!intent) return null
  return {
    documentId: intent.documentId,
    provider: intent.provider,
    invoiceId: intent.invoiceId,
    billNumber: intent.billNumber,
    paymentId: intent.paymentId,
    patientId: intent.patient?.id,
    doctorId: intent.doctor?.id,
    dateTime: intent.dateTime,
    roomId: intent.roomId,
    type: intent.consultationType || 'video',
    language: intent.language,
    price: Number(intent.amount),
    amount: Number(intent.amount),
    appointmentId: intent.appointment?.documentId,
  }
}

function validateBookingPayload(booking) {
  if (!booking?.doctorId || !booking?.dateTime || !booking?.type || !booking?.roomId) {
    return 'Missing booking fields'
  }
  if (!['video', 'chat'].includes(booking.type)) return 'Invalid consultation type'
  const dateTime = new Date(booking.dateTime)
  if (!Number.isFinite(dateTime.getTime()) || dateTime <= new Date()) {
    return 'Invalid appointment dateTime'
  }
  if (typeof booking.roomId !== 'string' || booking.roomId.length > 128) {
    return 'Invalid roomId'
  }
  return null
}

// =====================================================
// Simple in-memory rate limiter for payment endpoints
// =====================================================
const rateLimitStore = new Map()

function isRateLimited(ip, endpoint, max, windowMs) {
  const key = `${ip}:${endpoint}`
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  if (entry.count >= max) return true
  entry.count++
  return false
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key)
  }
}, 30 * 60 * 1000)

// Fetch the canonical price for a doctor from Strapi.
// Returns the price as a number, or throws if the doctor is not found / request fails.
async function fetchDoctorPrice(doctorId) {
  const res = await fetch(
    `${STRAPI_API_URL}/api/doctors?filters[id][$eq]=${encodeURIComponent(doctorId)}&fields[0]=price`,
    {
      headers: { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN || ''}` },
    }
  )
  if (!res.ok) throw new Error(`Strapi returned HTTP ${res.status} when fetching doctor price`)
  const json = await res.json()
  const doctor = json?.data?.[0]
  if (!doctor) throw new Error(`Doctor ${doctorId} not found`)
  const price = doctor.price ?? doctor.attributes?.price
  if (price == null || isNaN(Number(price))) throw new Error(`Doctor ${doctorId} has no valid price`)
  return Number(price)
}

// =====================================================
// Halyk QR Payment — server-side store
// Map: billNumber → { booking, userToken, accessToken, invoiceId, createdAt }
// =====================================================
const pendingQRPayments = new Map()

// Confirmed card-payment invoiceIds — prevents in-process replay.
// Persistent idempotency is handled via paymentId field in Strapi (survives restarts).
const confirmedInvoices = new Map()
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000
  for (const [id, entry] of confirmedInvoices) {
    if (entry.createdAt < cutoff) confirmedInvoices.delete(id)
  }
}, 5 * 60 * 1000)

// Intent store: invoiceId → { doctorId, dateTime, amount }
// Set at epay-token time so epay-confirm can verify the booking hasn't been swapped.
// TTL: 30 min (max ePay widget session).
const pendingCardPayments = new Map()
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000
  for (const [id, entry] of pendingCardPayments) {
    if (entry.createdAt < cutoff) pendingCardPayments.delete(id)
  }
}, 10 * 60 * 1000)

// =====================================================
// Real-time slot reservations (cinema-style)
// Map key: `${doctorId}|${date}|${time}`
// Map value: { socketId, userId, expiresAt, timer }
// =====================================================
const pendingSlotReservations = new Map()
const SLOT_RESERVATION_TTL = 5 * 60 * 1000 // 5 minutes

function releaseSlotBySocket(socketId) {
  for (const [key, val] of pendingSlotReservations) {
    if (val.socketId === socketId) {
      clearTimeout(val.timer)
      pendingSlotReservations.delete(key)
      const [doctorId, date, time] = key.split('|')
      io.to(`slots:${doctorId}:${date}`).emit('slot-released', { time })
      console.log(`[Slots] Auto-released ${key} (socket ${socketId} disconnected)`)
    }
  }
}

// Cleanup entries older than 25 minutes (ePay QR expires in 20 min)
setInterval(() => {
  const cutoff = Date.now() - 25 * 60 * 1000
  for (const [id, data] of pendingQRPayments) {
    if (data.createdAt < cutoff) pendingQRPayments.delete(id)
  }
}, 5 * 60 * 1000)

// Helper: get ePay OAuth token (for card widget payments)
async function getEPayAuthToken(invoiceId, amount, currency = 'KZT') {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: EPAY_CLIENT_ID,
    client_secret: EPAY_CLIENT_SECRET,
    scope: 'webapi usermanagement email_send verification statement statistics payment',
    invoiceID: String(invoiceId),
    amount: String(Math.round(Number(amount))),
    currency,
    terminal: EPAY_TERMINAL_ID,
    postLink: '',
    failurePostLink: '',
  })
  const response = await fetch(EPAY_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await response.json()
  if (!data.access_token) throw new Error('ePay OAuth failed: ' + JSON.stringify(data))
  return {
    access_token: data.access_token,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in,
    scope: data.scope,
  }
}

// Helper: get ePay OAuth token using QR-specific credentials
async function getQRAuthToken(invoiceId, amount, currency = 'KZT') {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: EPAY_QR_CLIENT_ID,
    client_secret: EPAY_QR_CLIENT_SECRET,
    scope: 'webapi usermanagement email_send verification statement statistics payment',
    invoiceID: String(invoiceId),
    amount: String(Math.round(Number(amount))),
    currency,
    terminal: EPAY_QR_TERMINAL_ID,
    postLink: '',
    failurePostLink: '',
  })
  const response = await fetch(EPAY_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = await response.json()
  if (!data.access_token) throw new Error('ePay QR OAuth failed: ' + JSON.stringify(data))
  return {
    access_token: data.access_token,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in,
    scope: data.scope,
  }
}

// POST /api/payment/create-halyk-qr
// Step 1+2 of ePay QR by API: get token, generate QR, return qrcode + homebankLink
app.post('/api/payment/create-halyk-qr', async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(clientIp, 'create-halyk-qr', 10, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many payment requests. Please try again later.' })
  }
  try {
    if (!PAYMENTS_LIVE) {
      return res.status(503).json({ error: 'Live payments are disabled' })
    }

    const { bookingData } = req.body
    const userToken = getBearerToken(req)
    const patient = await verifyHttpUserToken(userToken)
    if (!bookingData || !patient?.id) {
      return res.status(401).json({ error: 'Authenticated bookingData required' })
    }

    const bookingError = validateBookingPayload(bookingData)
    if (bookingError) {
      return res.status(400).json({ error: bookingError })
    }

    // Validate price against the canonical doctor price in Strapi
    const actualPrice = await fetchDoctorPrice(bookingData.doctorId)
    const submittedPrice = Number(bookingData.price)

    if (!submittedPrice || submittedPrice !== actualPrice) {
      console.warn(
        `[QR] Price mismatch for doctor ${bookingData.doctorId}: submitted=${submittedPrice} actual=${actualPrice}`
      )
      return res.status(400).json({ error: 'Invalid payment amount' })
    }

    const invoiceId = String(Date.now())

    // Step 1: Get OAuth token using QR-specific credentials
    const auth = await getQRAuthToken(invoiceId, actualPrice)

    // Step 2: Generate QR code via official ePay QR API
    const qrRes = await fetch(EPAY_QR_GENERATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${auth.token_type} ${auth.access_token}`,
      },
      body: JSON.stringify({
        // postLink must be a valid URL — ePay validates it.
        // In dev ePay can't reach localhost, so we use the prod server URL as placeholder.
        // Payment confirmation relies on polling regardless.
        postLink: 'https://medconnectrtc.nnmc.kz/api/payment/epay-callback',
        failurePostLink: 'https://medconnectrtc.nnmc.kz/api/payment/epay-failure-callback',
        description: `Консультация у ${bookingData.doctorName}`,
        language: 'ru',
        accountId: String(patient.id),
        ...(patient.email && { payerEmail: patient.email }),
        ...(patient.phone && { payerPhone: patient.phone }),
      }),
    })

    const rawText = await qrRes.text()
    console.log(`[QR Generate] HTTP ${qrRes.status}`)

    if (!qrRes.ok) {
      throw new Error(`ePay QR HTTP ${qrRes.status}: ${rawText}`)
    }

    const qrData = JSON.parse(rawText)

    if (!qrData.qrcode && !qrData.billNumber) {
      throw new Error('QR generation failed: ' + rawText)
    }

    const billNumber = qrData.billNumber
    const paymentId = `qr:${billNumber}`

    const persistedIntent = await createPaymentIntent({
      provider: 'halyk_qr',
      invoiceId,
      billNumber: String(billNumber),
      paymentId,
      status: 'pending',
      amount: actualPrice,
      currency: 'KZT',
      dateTime: bookingData.dateTime,
      roomId: bookingData.roomId,
      consultationType: bookingData.type,
      language: bookingData.language || null,
      patient: patient.id,
      doctor: bookingData.doctorId,
      metadata: { source: 'create-halyk-qr' },
    })

    // Store pending payment for status polling — always use server-verified price
    pendingQRPayments.set(String(billNumber), {
      ...bookingData,
      documentId: persistedIntent?.documentId,
      patientId: patient.id,
      patientName: patient.fullName || patient.username || '',
      patientEmail: patient.email || '',
      patientPhone: patient.phone || '',
      price: actualPrice,
      invoiceId,
      paymentId,
      accessToken: auth.access_token,
      tokenType: auth.token_type || 'Bearer',
      tokenExpiresAt: Date.now() + (auth.expires_in - 30) * 1000,
      userToken,
      createdAt: Date.now(),
      appointmentCreated: false,
    })

    console.log(`[QR] Created pending payment billNumber: ${billNumber}`)
    res.json({
      billNumber,
      qrcode: qrData.qrcode,
      homebankLink: qrData.homebankLink || null,
      onlinebankLink: qrData.onlinebankLink || null,
    })
  } catch (err) {
    console.error('[QR] create error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/payment/halyk-qr-status/:billNumber
// Step 3: Poll QR payment status — returns current ePay status
// On PAID: creates appointment in Strapi (once) and returns { status: 'PAID' }
app.get('/api/payment/halyk-qr-status/:billNumber', async (req, res) => {
  const { billNumber } = req.params
  let pending = pendingQRPayments.get(billNumber)

  if (!pending) {
    const persisted = normalizePersistedIntent(await findPaymentIntent('billNumber', billNumber))
    if (!persisted) {
      return res.status(404).json({ error: 'Payment session not found or expired' })
    }
    pending = {
      ...persisted,
      accessToken: null,
      tokenType: 'Bearer',
      tokenExpiresAt: 0,
      userToken: null,
      createdAt: Date.now(),
      appointmentCreated: Boolean(persisted.appointmentId),
    }
    pendingQRPayments.set(String(billNumber), pending)
  }

  try {
    const requester = await verifyHttpUserToken(getBearerToken(req))
    if (!requester?.id) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    if (String(requester.id) !== String(pending.patientId)) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get a fresh token if current one is close to expiry
    let accessToken = pending.accessToken
    let tokenType = pending.tokenType
    if (Date.now() >= pending.tokenExpiresAt) {
      const freshAuth = await getQRAuthToken(pending.invoiceId, pending.price)
      accessToken = freshAuth.access_token
      tokenType = freshAuth.token_type
      pending.accessToken = accessToken
      pending.tokenType = tokenType
      pending.tokenExpiresAt = Date.now() + (freshAuth.expires_in - 30) * 1000
    }

    // Check QR payment status
    const statusRes = await fetch(`${EPAY_QR_STATUS_URL}?billNumber=${billNumber}`, {
      headers: { Authorization: `${tokenType} ${accessToken}` },
    })
    const statusRaw = await statusRes.text()
    console.log(`[QR Status] billNumber=${billNumber} HTTP=${statusRes.status}`)

    const statusData = JSON.parse(statusRaw)
    const status = statusData.status || 'UNKNOWN'

    // Create appointment exactly once when payment is confirmed.
    // Flag is set AFTER successful creation to ensure idempotency on server crash/retry.
    if (status === 'PAID' && !pending.appointmentCreated) {
      try {
        const existing = await fetchExistingAppointmentByPaymentId(pending.paymentId)
        if (existing) {
          pending.appointmentCreated = true
          await updatePaymentIntent(pending.documentId, {
            status: 'appointment_created',
            appointment: existing.documentId,
          })
          setTimeout(() => pendingQRPayments.delete(billNumber), 60 * 1000)
          return res.json({ status, billNumber, appointmentId: existing.documentId || existing.id })
        }

        const apptRes = await fetch(`${STRAPI_API_URL}/api/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
          },
          body: JSON.stringify({
            data: {
              patient: pending.patientId,
              doctor: pending.doctorId,
              dateTime: pending.dateTime,
              type: pending.type,
              statuse: 'confirmed',
              price: pending.price,
              paymentStatus: 'paid',
              paymentId: pending.paymentId,
              roomId: pending.roomId,
            },
          }),
        })
        if (!apptRes.ok) {
          const errText = await apptRes.text().catch(() => '')
          throw new Error(`Strapi HTTP ${apptRes.status}: ${errText}`)
        }
        // Only mark as created after confirmed success — allows safe retry on failure
        pending.appointmentCreated = true
        const apptJson = await apptRes.json().catch(() => null)
        await updatePaymentIntent(pending.documentId, {
          status: 'appointment_created',
          appointment: apptJson?.data?.documentId,
        })
        console.log(`[QR] Appointment created for billNumber: ${billNumber}`)
        setTimeout(() => pendingQRPayments.delete(billNumber), 60 * 1000)
      } catch (err) {
        console.error('[QR] appointment creation error:', err.message)
        // appointmentCreated stays false — next poll will retry
      }
    }

    res.json({ status, billNumber })
  } catch (err) {
    console.error('[QR] status error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/slot/verify
// Final check before payment: ensures the slot is held by THIS user AND not booked in Strapi DB
app.post('/api/slot/verify', async (req, res) => {
  try {
    const { doctorId, date, time, socketId, slotDuration } = req.body
    if (!doctorId || !date || !time || !socketId) {
      return res.status(400).json({ available: false, reason: 'Missing doctorId, date, time or socketId' })
    }

    const key = `${doctorId}|${date}|${time}`

    // 1. Check socket reservation — slot must be held by this user's socket
    const reservation = pendingSlotReservations.get(key)
    if (!reservation || reservation.expiresAt <= Date.now()) {
      if (reservation) pendingSlotReservations.delete(key)
      return res.status(409).json({ available: false, reason: 'Слот не был зарезервирован или срок резерва истёк' })
    }
    if (reservation.socketId !== socketId) {
      return res.status(409).json({ available: false, reason: 'Это время выбрано другим пациентом' })
    }

    // 2. Check Strapi DB — slot must not be already booked.
    // Fail CLOSED: if DB is unreachable we cannot confirm availability, so we reject.
    // Booking UI dates/times are Kazakhstan local time. Make that explicit so
    // slot checks are stable on UTC production hosts too.
    const dateTime = new Date(`${date}T${time}:00+05:00`)
    if (Number.isNaN(dateTime.getTime())) {
      return res.status(400).json({ available: false, reason: 'Invalid date or time' })
    }
    // Use the actual slot duration so we don't produce false conflicts.
    // Example with 30-min slots: booking 14:30 must NOT block 14:00 (ends at
    // 14:30, no overlap). A fixed 1h window would extend to 15:00 and
    // incorrectly find the 14:30 booking as a conflict for the 14:00 slot.
    const durationMs = (Number.isFinite(slotDuration) && slotDuration > 0 ? slotDuration : 30) * 60 * 1000
    const slotEnd = new Date(dateTime.getTime() + durationMs)
    let strapiCheck
    try {
      const query = new URLSearchParams({
        doctorId: String(doctorId),
        start: dateTime.toISOString(),
        end: slotEnd.toISOString(),
      })
      // Use the Strapi API token — it bypasses users-permissions policy entirely.
      // API tokens are recognised by Strapi's api-token auth strategy and never
      // hit the users-permissions PolicyError that blocks user-JWT and anon calls.
      const headers = {
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
      }
      if (process.env.SIGNALING_INTERNAL_SECRET) {
        headers['X-Internal-Secret'] = process.env.SIGNALING_INTERNAL_SECRET
      }
      strapiCheck = await fetch(`${STRAPI_API_URL}/api/appointments/slot-conflicts?${query}`, { headers })
    } catch (fetchErr) {
      console.error('[Slot verify] Strapi unreachable:', fetchErr.message)
      return res.status(503).json({ available: false, reason: 'Сервис временно недоступен. Попробуйте снова.' })
    }

    if (!strapiCheck.ok) {
      const errorBody = await strapiCheck.text().catch(() => '')
      console.error('[Slot verify] Strapi responded HTTP', strapiCheck.status, errorBody.slice(0, 300))
      return res.status(503).json({ available: false, reason: 'Сервис временно недоступен. Попробуйте снова.' })
    }

    const strapiData = await strapiCheck.json()
    const conflicts = Number(strapiData?.data?.conflicts || 0)
    if (conflicts > 0 || strapiData?.data?.available === false) {
      // Slot is already booked in DB — also update socket reservations
      if (!pendingSlotReservations.has(key)) {
        io.to(`slots:${doctorId}:${date}`).emit('slot-booked', { time })
      }
      return res.json({ available: false, reason: 'Это время уже забронировано' })
    }

    res.json({ available: true })
  } catch (err) {
    console.error('[Slot verify] error:', err.message)
    res.status(500).json({ available: false, reason: 'Ошибка проверки' })
  }
})

// POST /api/payment/epay-confirm
// Creates an appointment after a successful ePay card/redirect payment.
// Uses STRAPI_API_TOKEN so the PAYMENTS_LIVE patient-guard is bypassed (server-trusted path).
// The caller provides their JWT in Authorization; we resolve patientId from /users/me.
// In live mode (PAYMENTS_LIVE=true) we verify the invoiceId with ePay before creating the appointment.
app.post('/api/payment/epay-confirm', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || ''
    const userToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!userToken) {
      return res.status(401).json({ error: 'Missing Authorization header' })
    }

    const { booking } = req.body
    if (!booking || !booking.doctorId || !booking.dateTime || !booking.type) {
      return res.status(400).json({ error: 'Missing booking fields' })
    }

    const invoiceId = booking.invoiceId ? String(booking.invoiceId) : null

    // --- Fast in-process replay protection ---
    if (invoiceId && confirmedInvoices.has(invoiceId)) {
      return res.status(409).json({ error: 'This payment has already been processed' })
    }

    // --- Persistent idempotency: check Strapi for an appointment already created for this invoiceId ---
    // This survives server restarts and TTL expiry of the in-memory confirmedInvoices map.
    if (invoiceId) {
      const existingRes = await fetch(
        `${STRAPI_API_URL}/api/appointments?filters[paymentId][$eq]=${encodeURIComponent(invoiceId)}&fields[0]=id&pagination[pageSize]=1`,
        { headers: { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}` } }
      ).catch(() => null)
      if (existingRes?.ok) {
        const existingData = await existingRes.json().catch(() => null)
        if (existingData?.data?.length > 0) {
          console.log(`[epay-confirm] idempotent: appointment already exists for invoiceId=${invoiceId}`)
          return res.status(409).json({ error: 'This payment has already been processed' })
        }
      }
    }

    // --- Resolve the patient's numeric id from their JWT (needed for ePay accountId check) ---
    const meRes = await fetch(`${STRAPI_API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
    if (!meRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired user token' })
    }
    const meData = await meRes.json()
    const patientId = meData?.id
    if (!patientId) {
      return res.status(401).json({ error: 'Could not resolve patient' })
    }

    let verifiedPaymentIntent = null

    // --- Live mode: verify payment status, amount, and owner with ePay ---
    if (process.env.PAYMENTS_LIVE === 'true') {
      if (!invoiceId) {
        return res.status(400).json({ error: 'invoiceId is required in live payment mode' })
      }
      if (!EPAY_CLIENT_ID || !EPAY_CLIENT_SECRET) {
        console.error('[epay-confirm] ePay credentials not configured')
        return res.status(503).json({ error: 'Payment verification unavailable' })
      }
      try {
        const persistedIntent = normalizePersistedIntent(await findPaymentIntent('invoiceId', invoiceId))
        const intent = pendingCardPayments.get(invoiceId) || persistedIntent
        if (!intent) {
          console.warn(`[epay-confirm] missing payment intent for invoiceId=${invoiceId}`)
          return res.status(402).json({ error: 'Payment intent expired. Contact support with your payment receipt.' })
        }
        verifiedPaymentIntent = intent

        const expectedAmount = Math.round(Number(intent.amount || intent.price))
        const auth = await getEPayAuthToken(invoiceId, expectedAmount)
        const statusRes = await fetch(
          `${EPAY_TRANSACTION_STATUS_URL}?invoiceId=${encodeURIComponent(invoiceId)}`,
          { headers: { Authorization: `${auth.token_type} ${auth.access_token}` } }
        )
        if (!statusRes.ok) {
          const errText = await statusRes.text().catch(() => '')
          throw new Error(`ePay status API HTTP ${statusRes.status}: ${errText}`)
        }
        const statusData = await statusRes.json()
        // ePay may return an array or { transactions: [] } depending on the endpoint
        const transactions = Array.isArray(statusData)
          ? statusData
          : (statusData?.transactions || [statusData])

        const paidTx = transactions.find((t) => t?.status === 'PAID')
        if (!paidTx) {
          console.warn(`[epay-confirm] invoiceId=${invoiceId} not PAID:`, JSON.stringify(statusData))
          return res.status(402).json({ error: 'Payment not confirmed by ePay' })
        }

        // Verify amount: prevents using a cheaper payment to confirm a pricier booking
        const txAmount = Math.round(Number(paidTx.amount))
        if (!expectedAmount || txAmount !== expectedAmount) {
          console.warn(`[epay-confirm] Amount mismatch: tx=${txAmount} expected=${expectedAmount} invoiceId=${invoiceId}`)
          return res.status(402).json({ error: 'Payment amount does not match booking price' })
        }

        // Verify accountId: prevents using another user's paid invoiceId.
        // accountId was set to String(user.id) when the payment was initiated in BookingModal.
        // Fail closed: if ePay omits accountId we cannot prove ownership → reject.
        if (!paidTx.accountId || String(paidTx.accountId) !== String(patientId)) {
          console.warn(`[epay-confirm] accountId mismatch or missing: tx=${paidTx.accountId} patient=${patientId} invoiceId=${invoiceId}`)
          return res.status(402).json({ error: 'Payment owner could not be verified' })
        }

        // Verify booking intent: doctor and dateTime must match what was stored at epay-token time.
        // Prevents reusing a valid invoiceId for a different slot (same price, different doctor/time).
        if (String(intent.patientId) !== String(patientId)) {
          console.warn(`[epay-confirm] patient mismatch: intent=${intent.patientId} patient=${patientId} invoiceId=${invoiceId}`)
          return res.status(402).json({ error: 'Payment was made by a different patient' })
        }
        if (String(intent.doctorId) !== String(booking.doctorId)) {
          console.warn(`[epay-confirm] doctor mismatch: intent=${intent.doctorId} booking=${booking.doctorId} invoiceId=${invoiceId}`)
          return res.status(402).json({ error: 'Payment was made for a different doctor' })
        }
        if (intent.dateTime && intent.dateTime !== booking.dateTime) {
          console.warn(`[epay-confirm] dateTime mismatch: intent=${intent.dateTime} booking=${booking.dateTime} invoiceId=${invoiceId}`)
          return res.status(402).json({ error: 'Payment was made for a different time slot' })
        }
      } catch (err) {
        console.error('[epay-confirm] ePay verification error:', err.message)
        return res.status(502).json({ error: 'Could not verify payment status with ePay' })
      }
    }

    const apptRes = await fetch(`${STRAPI_API_URL}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
      },
      body: JSON.stringify({
        data: {
          patient: patientId,
          doctor: booking.doctorId,
          dateTime: booking.dateTime,
          type: booking.type,
          statuse: 'confirmed',
          price: verifiedPaymentIntent?.amount || verifiedPaymentIntent?.price || booking.price,
          paymentStatus: 'paid',
          roomId: booking.roomId,
          ...(invoiceId ? { paymentId: invoiceId } : {}),
        },
      }),
    })

    if (!apptRes.ok) {
      const errText = await apptRes.text().catch(() => '')
      console.error('[epay-confirm] Strapi error:', apptRes.status, errText)
      return res.status(502).json({ error: `Appointment creation failed: HTTP ${apptRes.status}` })
    }

    // Mark invoice as confirmed and clean up intent store
    if (invoiceId) {
      confirmedInvoices.set(invoiceId, { createdAt: Date.now() })
      pendingCardPayments.delete(invoiceId)
    }

    const apptData = await apptRes.json()
    const persistedIntent = invoiceId ? await findPaymentIntent('invoiceId', invoiceId) : null
    if (persistedIntent?.documentId) {
      await updatePaymentIntent(persistedIntent.documentId, {
        status: 'appointment_created',
        appointment: apptData?.data?.documentId,
      })
    }
    console.log('[epay-confirm] Appointment created for patient', patientId)
    res.json({ success: true, data: apptData.data })
  } catch (err) {
    console.error('[epay-confirm] error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// =====================================================
// POST /api/payment/epay-callback  (ePay postLink — server-to-server)
// ePay calls this after card payment completes. We verify HMAC-SHA512
// using TildaSecret, then create the appointment directly in Strapi.
// Handles the case where the user closes the browser before the redirect.
// =====================================================
function verifyEPayWebhookSignature(rawBody, signatureHex, secret) {
  if (!secret || !signatureHex) return false
  try {
    const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
    const expBuf = Buffer.from(expected, 'hex')
    const gotBuf = Buffer.from(signatureHex, 'hex')
    if (expBuf.length !== gotBuf.length) return false
    return crypto.timingSafeEqual(expBuf, gotBuf)
  } catch {
    return false
  }
}

app.post('/api/payment/epay-callback', async (req, res) => {
  res.sendStatus(200) // ACK immediately — ePay retries on non-200

  const rawBody = req.rawBody
  const signature = req.headers['x-back-sign'] || ''

  if (EPAY_TILDA_SECRET && rawBody) {
    if (!verifyEPayWebhookSignature(rawBody, signature, EPAY_TILDA_SECRET)) {
      console.warn('[ePay webhook] invalid HMAC-SHA512 signature — dropping')
      return
    }
  } else if (!EPAY_TILDA_SECRET) {
    console.warn('[ePay webhook] EPAY_TILDA_SECRET not set — skipping sig check')
  }

  const payload = req.body
  console.log('[ePay webhook] payload:', JSON.stringify(payload))

  const invoiceId = payload?.invoiceId ? String(payload.invoiceId) : null
  const status = String(payload?.status || payload?.payment_status || '').toUpperCase()
  const txAmount = Math.round(Number(payload?.amount || 0))

  if (!invoiceId || status !== 'PAID') {
    console.log(`[ePay webhook] skip: invoiceId=${invoiceId} status=${status}`)
    return
  }
  if (confirmedInvoices.has(invoiceId)) return

  const existing = await fetchExistingAppointmentByPaymentId(invoiceId).catch(() => null)
  if (existing) {
    confirmedInvoices.set(invoiceId, { createdAt: Date.now() })
    return
  }

  const persistedIntent = normalizePersistedIntent(
    await findPaymentIntent('invoiceId', invoiceId).catch(() => null)
  )
  const intent = pendingCardPayments.get(invoiceId) || persistedIntent
  if (!intent) {
    console.warn(`[ePay webhook] no intent for invoiceId=${invoiceId}`)
    return
  }

  const expectedAmount = Math.round(Number(intent.amount || intent.price || 0))
  if (!expectedAmount || txAmount !== expectedAmount) {
    console.warn(`[ePay webhook] amount mismatch: tx=${txAmount} expected=${expectedAmount}`)
    return
  }

  try {
    const apptRes = await fetch(`${STRAPI_API_URL}/api/appointments`, {
      method: 'POST',
      headers: strapiServerHeaders(),
      body: JSON.stringify({
        data: {
          patient: intent.patientId,
          doctor: intent.doctorId,
          dateTime: intent.dateTime,
          type: intent.consultationType || 'video',
          statuse: 'confirmed',
          price: expectedAmount,
          paymentStatus: 'paid',
          roomId: intent.roomId || `room-webhook-${invoiceId}`,
          paymentId: invoiceId,
        },
      }),
    })
    if (apptRes.ok) {
      confirmedInvoices.set(invoiceId, { createdAt: Date.now() })
      pendingCardPayments.delete(invoiceId)
      const apptData = await apptRes.json().catch(() => null)
      const stored = await findPaymentIntent('invoiceId', invoiceId).catch(() => null)
      if (stored?.documentId) {
        await updatePaymentIntent(stored.documentId, {
          status: 'appointment_created',
          appointment: apptData?.data?.documentId,
        }).catch(() => {})
      }
      console.log(`[ePay webhook] appointment created for invoiceId=${invoiceId}`)
    } else {
      const errText = await apptRes.text().catch(() => '')
      console.error(`[ePay webhook] appt create HTTP ${apptRes.status}: ${errText}`)
    }
  } catch (err) {
    console.error('[ePay webhook] error:', err.message)
  }
})

app.post('/api/payment/epay-failure-callback', (req, res) => {
  const payload = req.body
  console.warn('[ePay failure callback]', JSON.stringify(payload))
  res.sendStatus(200)
})

// POST /api/payment/epay-token
// Generates ePay OAuth token server-side (keeps ClientSecret secure)
app.post('/api/payment/epay-token', async (req, res) => {
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown'
  if (isRateLimited(clientIp, 'epay-token', 10, 60 * 60 * 1000)) {
    return res.status(429).json({ error: 'Too many payment requests. Please try again later.' })
  }
  try {
    if (!PAYMENTS_LIVE) {
      return res.status(503).json({ error: 'Live payments are disabled' })
    }

    const patient = await verifyHttpUserToken(getBearerToken(req))
    if (!patient?.id) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const { invoiceId, amount, doctorId, dateTime, currency = 'KZT' } = req.body
    if (!invoiceId || !amount || !doctorId) {
      return res.status(400).json({ error: 'invoiceId, amount and doctorId required' })
    }

    // Validate amount against canonical doctor price in Strapi
    const actualPrice = await fetchDoctorPrice(doctorId)
    const submittedAmount = Number(amount)

    if (!submittedAmount || submittedAmount !== actualPrice) {
      console.warn(
        `[ePay] Amount mismatch for doctor ${doctorId}: submitted=${submittedAmount} actual=${actualPrice}`
      )
      return res.status(400).json({ error: 'Invalid payment amount' })
    }

    // Bind invoiceId to this specific doctor/slot so epay-confirm can detect swaps
    pendingCardPayments.set(String(invoiceId), {
      doctorId: String(doctorId),
      patientId: String(patient.id),
      dateTime: dateTime || null,
      amount: actualPrice,
      createdAt: Date.now(),
    })

    await createPaymentIntent({
      provider: 'epay_card',
      invoiceId: String(invoiceId),
      paymentId: String(invoiceId),
      status: 'pending',
      amount: actualPrice,
      currency,
      dateTime,
      roomId: req.body.roomId || `pending-${invoiceId}`,
      consultationType: req.body.type || 'video',
      patient: patient.id,
      doctor: doctorId,
      metadata: { source: 'epay-token' },
    })

    const auth = await getEPayAuthToken(invoiceId, actualPrice, currency)
    res.json({ auth, terminalId: EPAY_TERMINAL_ID, widgetUrl: EPAY_WIDGET_URL })
  } catch (err) {
    console.error('ePay token error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// Socket.io сервер
const io = new Server(server, {
  cors: corsOptions,
})

// Verified token cache: token → { userId, expiresAt }
// Avoids hitting Strapi /api/users/me on every socket event.
const tokenCache = new Map()
const TOKEN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function verifySocketToken(token) {
  if (!token) return null
  const now = Date.now()
  const cached = tokenCache.get(token)
  if (cached && now < cached.expiresAt) return cached.user

  const res = await fetch(`${STRAPI_API_URL}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)

  if (!res?.ok) {
    tokenCache.delete(token)
    return null
  }
  const user = await res.json().catch(() => null)
  if (!user?.id) return null

  tokenCache.set(token, { user, expiresAt: now + TOKEN_CACHE_TTL })
  return user
}

// Room access cache: roomId -> { patientId, doctorUserId, expiresAt }
// Avoids hitting Strapi for every join / message.
const roomAccessCache = new Map()
const ROOM_ACCESS_TTL = 60 * 1000

async function fetchAppointmentRoom(roomId) {
  if (!roomId) return null
  const now = Date.now()
  const cached = roomAccessCache.get(roomId)
  if (cached && now < cached.expiresAt) return cached

  const url =
    `${STRAPI_API_URL}/api/appointments` +
    `?filters[roomId][$eq]=${encodeURIComponent(roomId)}` +
    `&populate[patient][fields][0]=id` +
    `&populate[doctor][populate][users_permissions_user][fields][0]=id` +
    `&populate[doctor][fields][0]=userId`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN || ''}` },
  }).catch(() => null)
  if (!res?.ok) return null
  const data = await res.json().catch(() => null)
  const appt = data?.data?.[0]
  if (!appt) return null

  const patientId = appt.patient?.id ?? null
  const doctorUserId =
    appt.doctor?.users_permissions_user?.id ?? appt.doctor?.userId ?? null
  const entry = { patientId, doctorUserId, expiresAt: now + ROOM_ACCESS_TTL }
  roomAccessCache.set(roomId, entry)
  return entry
}

// Cleanup expired token cache entries every 10 minutes
setInterval(() => {
  const now = Date.now()
  for (const [token, entry] of tokenCache) {
    if (now >= entry.expiresAt) tokenCache.delete(token)
  }
}, 10 * 60 * 1000)

// Auth middleware — rejects unauthenticated socket connections
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '')
  const user = await verifySocketToken(token)
  if (!user?.id) {
    return next(new Error('Authentication required'))
  }
  socket.verifiedToken = token
  socket.verifiedUser = user
  socket.verifiedUserId = user.id
  next()
})

// Хранение комнат и участников
const rooms = new Map()

// Структура комнаты:
// {
//   id: string,
//   participants: Map<socketId, { id, name, role }>,
//   messages: [{ id, message, senderName, userId, senderId, timestamp }]
// }
const MAX_CHAT_HISTORY = 200

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Присоединение к комнате
  socket.on('join-room', async ({ roomId, isPortrait }) => {
    if (!roomId || typeof roomId !== 'string') {
      socket.emit('join-room-error', { reason: 'Invalid roomId' })
      return
    }

    // Authorize: fetch appointment and ensure this user is patient or doctor of it.
    const access = await fetchAppointmentRoom(roomId)
    if (!access) {
      socket.emit('join-room-error', { reason: 'Room not found' })
      return
    }
    const verifiedId = socket.verifiedUserId
    let role
    if (access.patientId && verifiedId === access.patientId) role = 'patient'
    else if (access.doctorUserId && verifiedId === access.doctorUserId) role = 'doctor'
    else {
      console.warn(`[SECURITY] User ${verifiedId} tried to join room ${roomId} without membership`)
      socket.emit('join-room-error', { reason: 'Access denied' })
      return
    }

    // Enforce the same server-time join window used by the frontend.
    // Membership alone is not enough: future, expired, cancelled, or completed
    // appointments must not open a signaling room.
    const canJoinRes = await fetch(
      `${STRAPI_API_URL}/api/appointments/can-join/${encodeURIComponent(roomId)}`,
      { headers: { Authorization: `Bearer ${socket.verifiedToken || ''}` } },
    ).catch(() => null)
    if (!canJoinRes?.ok) {
      socket.emit('join-room-error', { reason: 'Join check unavailable' })
      return
    }
    const canJoinData = await canJoinRes.json().catch(() => null)
    if (!canJoinData?.data?.allowed) {
      socket.emit('join-room-error', { reason: canJoinData?.data?.reason || 'Join not allowed' })
      return
    }

    const user = socket.verifiedUser || {}
    const userName = user.fullName || user.username || `User ${verifiedId}`
    console.log(`User ${userName} (${verifiedId}, ${role}) joining room ${roomId}`)

    // Создаём комнату если не существует
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        messages: [],
      })
    }

    const room = rooms.get(roomId)

    // Добавляем участника — все поля из проверенных серверных данных
    room.participants.set(socket.id, {
      id: verifiedId,
      name: userName,
      role,
      isPortrait: isPortrait === true,
      socketId: socket.id,
    })

    // Присоединяемся к комнате Socket.io
    socket.join(roomId)
    socket.roomId = roomId

    // Уведомляем других участников (включая ориентацию экрана)
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId: verifiedId,
      userName,
      userRole: role,
      isPortrait: isPortrait === true,
    })

    // Отправляем список текущих участников новому пользователю
    const existingParticipants = []
    room.participants.forEach((participant, socketId) => {
      if (socketId !== socket.id) {
        existingParticipants.push({
          socketId,
          ...participant,
        })
      }
    })

    socket.emit('room-participants', existingParticipants)

    // Отправляем историю чата новому участнику
    if (room.messages.length > 0) {
      socket.emit('chat-history', room.messages)
    }

    console.log(`Room ${roomId} now has ${room.participants.size} participants`)

    // First participant joined — transition confirmed → in_progress so the no_show
    // cron job doesn't incorrectly fire while the consultation is underway.
    if (room.participants.size === 1) {
      fetch(
        `${STRAPI_API_URL}/api/appointments?filters[roomId][$eq]=${encodeURIComponent(roomId)}` +
        `&filters[statuse][$eq]=confirmed&fields[0]=documentId&pagination[pageSize]=1`,
        { headers: { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}` } }
      )
        .then((r) => r.json())
        .then((data) => {
          const appt = data?.data?.[0]
          if (!appt?.documentId) return
          return fetch(`${STRAPI_API_URL}/api/appointments/${appt.documentId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}`,
            },
            body: JSON.stringify({ data: { statuse: 'in_progress' } }),
          })
        })
        .catch((err) => console.error('[join-room] Failed to set in_progress:', err.message))
    }
  })

  // Helper: find the room this socket actually joined, or null.
  const getJoinedRoom = () => {
    const roomId = socket.roomId
    if (!roomId) return null
    const room = rooms.get(roomId)
    if (!room) return null
    if (!room.participants.has(socket.id)) return null
    return { roomId, room, participant: room.participants.get(socket.id) }
  }

  // Helper: verify that targetSocketId is in the same room as this socket.
  const isPeerInSameRoom = (targetSocketId) => {
    const ctx = getJoinedRoom()
    if (!ctx || !targetSocketId) return false
    return ctx.room.participants.has(targetSocketId)
  }

  // WebRTC сигнализация - отправка offer
  socket.on('offer', ({ targetSocketId, offer }) => {
    if (!isPeerInSameRoom(targetSocketId)) return
    console.log(`Offer from ${socket.id} to ${targetSocketId}`)
    io.to(targetSocketId).emit('offer', {
      senderSocketId: socket.id,
      offer,
    })
  })

  // WebRTC сигнализация - отправка answer
  socket.on('answer', ({ targetSocketId, answer }) => {
    if (!isPeerInSameRoom(targetSocketId)) return
    console.log(`Answer from ${socket.id} to ${targetSocketId}`)
    io.to(targetSocketId).emit('answer', {
      senderSocketId: socket.id,
      answer,
    })
  })

  // WebRTC сигнализация - ICE candidate
  socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
    if (!isPeerInSameRoom(targetSocketId)) return
    io.to(targetSocketId).emit('ice-candidate', {
      senderSocketId: socket.id,
      candidate,
    })
  })

  // Чат в комнате — имя и id берём из серверного состояния, не с клиента
  socket.on('chat-message', ({ message }) => {
    const ctx = getJoinedRoom()
    if (!ctx) return
    if (typeof message !== 'string' || !message.trim()) return
    const { roomId, room, participant } = ctx
    const msgData = {
      id: Date.now(),
      message,
      senderName: participant.name,
      senderId: socket.id,
      userId: participant.id,
      timestamp: new Date().toISOString(),
    }
    room.messages.push(msgData)
    if (room.messages.length > MAX_CHAT_HISTORY) {
      room.messages.shift()
    }
    io.to(roomId).emit('chat-message', msgData)
  })

  // Переключение медиа (mute/unmute, video on/off)
  socket.on('media-toggle', ({ type, enabled }) => {
    const ctx = getJoinedRoom()
    if (!ctx) return
    socket.to(ctx.roomId).emit('user-media-toggle', {
      socketId: socket.id,
      type,
      enabled,
    })
  })

  // Ориентация устройства (portrait/landscape)
  socket.on('orientation-update', ({ isPortrait }) => {
    const ctx = getJoinedRoom()
    if (!ctx) return
    ctx.participant.isPortrait = isPortrait === true
    socket.to(ctx.roomId).emit('remote-orientation-update', {
      socketId: socket.id,
      isPortrait: isPortrait === true,
    })
  })

  // ── Real-time slot watching ──────────────────────────────────────

  socket.on('join-slot-watch', ({ doctorId, date }) => {
    const room = `slots:${doctorId}:${date}`
    socket.join(room)
    // Send existing reservations for this doctor+date
    const reservations = []
    for (const [key, val] of pendingSlotReservations) {
      const [dId, d, time] = key.split('|')
      if (dId === String(doctorId) && d === date) {
        reservations.push({ time, expiresAt: val.expiresAt })
      }
    }
    socket.emit('current-reservations', reservations)
  })

  socket.on('leave-slot-watch', ({ doctorId, date }) => {
    socket.leave(`slots:${doctorId}:${date}`)
  })

  socket.on('reserve-slot', ({ doctorId, date, time }) => {
    const userId = socket.verifiedUserId
    const key = `${doctorId}|${date}|${time}`

    // Check if slot is already held by ANOTHER socket
    const existing = pendingSlotReservations.get(key)
    if (existing && existing.socketId !== socket.id && existing.expiresAt > Date.now()) {
      // Slot is held by someone else — reject
      socket.emit('reserve-slot-result', {
        success: false,
        time,
        reason: 'Это время уже выбрано другим пациентом',
        heldUntil: existing.expiresAt,
      })
      console.log(`[Slots] REJECTED ${key} — already held by socket ${existing.socketId}`)
      return
    }

    // Release any previously held slot by this socket
    for (const [k, v] of pendingSlotReservations) {
      if (v.socketId === socket.id && k !== key) {
        clearTimeout(v.timer)
        pendingSlotReservations.delete(k)
        const [dId, d, t] = k.split('|')
        io.to(`slots:${dId}:${d}`).emit('slot-released', { time: t })
      }
    }
    const expiresAt = Date.now() + SLOT_RESERVATION_TTL
    const timer = setTimeout(() => {
      pendingSlotReservations.delete(key)
      io.to(`slots:${doctorId}:${date}`).emit('slot-released', { time })
      console.log(`[Slots] TTL expired: ${key}`)
    }, SLOT_RESERVATION_TTL)
    pendingSlotReservations.set(key, { socketId: socket.id, userId, expiresAt, timer })
    // socket.to(room) broadcasts to the room EXCLUDING the sender — the
    // reserving client already gets confirmation via reserve-slot-result and
    // does not need a slot-reserved echo (would be mistaken for a foreign hold).
    socket.to(`slots:${doctorId}:${date}`).emit('slot-reserved', { time, expiresAt })
    socket.emit('reserve-slot-result', { success: true, time, expiresAt })
    console.log(`[Slots] Reserved ${key} by socket ${socket.id}`)
  })

  socket.on('release-slot', ({ doctorId, date, time }) => {
    const key = `${doctorId}|${date}|${time}`
    const val = pendingSlotReservations.get(key)
    if (val && val.socketId === socket.id) {
      clearTimeout(val.timer)
      pendingSlotReservations.delete(key)
      io.to(`slots:${doctorId}:${date}`).emit('slot-released', { time })
      console.log(`[Slots] Released ${key}`)
    }
  })

  // Клиент вызывает после успешного создания записи — сервер рассылает
  // slot-booked всем наблюдателям, чтобы у них слот исчез, а не превратился
  // обратно в свободный после release.
  socket.on('slot-confirmed', ({ doctorId, date, time }) => {
    if (!doctorId || !date || !time) return
    const key = `${doctorId}|${date}|${time}`
    const val = pendingSlotReservations.get(key)

    // If a live reservation exists, only its owner may confirm it.
    // This prevents any authenticated user from faking a slot-booked broadcast.
    // If the reservation has already expired (TTL) the check is skipped —
    // the appointment is in Strapi by then, so the broadcast is legitimate.
    if (val && val.expiresAt > Date.now() && val.userId !== socket.verifiedUserId) {
      console.warn(`[Slots] slot-confirmed rejected: user ${socket.verifiedUserId} does not own ${key}`)
      return
    }

    if (val) {
      clearTimeout(val.timer)
      pendingSlotReservations.delete(key)
    }
    // Exclude sender: the booking client is on the success screen and doesn't
    // need a slot-booked echo that would clear its own selectedTime.
    socket.to(`slots:${doctorId}:${date}`).emit('slot-booked', { time })
    console.log(`[Slots] CONFIRMED ${key} by socket ${socket.id}`)
  })

  // Отключение
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    releaseSlotBySocket(socket.id)

    // Находим комнату пользователя
    const roomId = socket.roomId
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId)
      const participant = room.participants.get(socket.id)
      
      // Удаляем из комнаты
      room.participants.delete(socket.id)
      
      // Уведомляем других
      socket.to(roomId).emit('user-left', {
        socketId: socket.id,
        userId: participant?.id,
        userName: participant?.name,
      })
      
      // Удаляем пустую комнату
      if (room.participants.size === 0) {
        rooms.delete(roomId)
        console.log(`Room ${roomId} deleted (empty)`)
      }
    }
  })

  // Принудительное завершение звонка врачом
  socket.on('force-end-call', () => {
    const ctx = getJoinedRoom()
    if (!ctx) return
    if (ctx.participant.role !== 'doctor') {
      console.warn(`[SECURITY] Non-doctor ${socket.verifiedUserId} tried force-end-call in ${ctx.roomId}`)
      return
    }
    socket.to(ctx.roomId).emit('call-force-ended')
  })

  // Покинуть комнату
  socket.on('leave-room', () => {
    const roomId = socket.roomId
    if (roomId) {
      socket.leave(roomId)
      
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId)
        const participant = room.participants.get(socket.id)
        room.participants.delete(socket.id)
        
        socket.to(roomId).emit('user-left', {
          socketId: socket.id,
          userId: participant?.id,
          userName: participant?.name,
        })
        
        if (room.participants.size === 0) {
          rooms.delete(roomId)
        }
      }
      
      socket.roomId = null
    }
  })
})

// Health check endpoint — minimal response, no internal state exposed
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Dynamic sitemap — includes all active doctors from Strapi
// Cached for 1 hour to avoid hammering the DB on every bot crawl
let sitemapCache = null
let sitemapCachedAt = 0
const SITEMAP_TTL_MS = 60 * 60 * 1000

app.get('/sitemap-dynamic.xml', async (req, res) => {
  const now = Date.now()
  if (sitemapCache && now - sitemapCachedAt < SITEMAP_TTL_MS) {
    res.set('Content-Type', 'application/xml')
    return res.send(sitemapCache)
  }

  try {
    const doctorsRes = await fetch(
      `${STRAPI_API_URL}/api/doctors?filters[isActive][$eq]=true&fields[0]=documentId&fields[1]=updatedAt&pagination[limit]=500`,
      { headers: { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}` } }
    )
    const doctorsData = await doctorsRes.json()
    const doctors = doctorsData?.data || []
    const today = new Date().toISOString().slice(0, 10)

    const doctorUrls = doctors.map((d) => `
  <url>
    <loc>https://medconnect.nnmc.kz/doctors/${d.documentId}</loc>
    <lastmod>${d.updatedAt ? d.updatedAt.slice(0, 10) : today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://medconnect.nnmc.kz/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://medconnect.nnmc.kz/doctors</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>${doctorUrls}
</urlset>`

    sitemapCache = xml
    sitemapCachedAt = now
    res.set('Content-Type', 'application/xml')
    res.send(xml)
  } catch (err) {
    res.status(500).send('<!-- sitemap generation error -->')
  }
})

// Локально signaling-сервер работает на 1341
// В продакшене на отдельном домене: https://medconnectrtc.nnmc.kz
const PORT = process.env.PORT || 1341

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`)
  console.log('[Startup] slot verify uses /api/appointments/slot-conflicts and KZ timezone +05:00')
})
