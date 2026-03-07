require('dotenv').config()
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
const server = http.createServer(app)

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
app.use(express.json())

// =====================================================
// ePay (Halyk Bank) Payment Integration
// =====================================================
const EPAY_CLIENT_ID = process.env.EPAY_CLIENT_ID || 'test'
const EPAY_CLIENT_SECRET = process.env.EPAY_CLIENT_SECRET || 'yF587AV9Ms94qN2QShFzVR3vFnWkhjbAK3sG'
const EPAY_TERMINAL_ID = process.env.EPAY_TERMINAL_ID || '67e34d63-102f-4bd1-898e-370781d0074d'
const IS_EPAY_TEST = process.env.EPAY_TEST !== 'false'

// QR-specific credentials (different terminal with pay_qr_local enabled)
const EPAY_QR_CLIENT_ID = process.env.EPAY_QR_CLIENT_ID || 'EPAY-TEST-PAYMENT'
const EPAY_QR_CLIENT_SECRET = process.env.EPAY_QR_CLIENT_SECRET || 'gG1uIMT$cTZJS&Lm'
const EPAY_QR_TERMINAL_ID = process.env.EPAY_QR_TERMINAL_ID || '5f7bdf8b-f34c-4aed-bd0c-47fa1e323496'

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

const STRAPI_API_URL = process.env.STRAPI_API_URL || 'http://localhost:1340'

// =====================================================
// Halyk QR Payment — server-side store
// Map: billNumber → { booking, userToken, accessToken, invoiceId, createdAt }
// =====================================================
const pendingQRPayments = new Map()

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
  try {
    const { bookingData, userToken } = req.body
    if (!bookingData || !userToken) {
      return res.status(400).json({ error: 'bookingData and userToken required' })
    }

    const invoiceId = String(Date.now())

    // Step 1: Get OAuth token using QR-specific credentials
    const auth = await getQRAuthToken(invoiceId, bookingData.price)

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
        ...(bookingData.patientId && { accountId: String(bookingData.patientId) }),
        ...(bookingData.patientEmail && { payerEmail: bookingData.patientEmail }),
        ...(bookingData.patientPhone && { payerPhone: bookingData.patientPhone }),
      }),
    })

    const rawText = await qrRes.text()
    console.log(`[QR Generate] HTTP ${qrRes.status}: ${rawText}`)

    if (!qrRes.ok) {
      throw new Error(`ePay QR HTTP ${qrRes.status}: ${rawText}`)
    }

    const qrData = JSON.parse(rawText)

    if (!qrData.qrcode && !qrData.billNumber) {
      throw new Error('QR generation failed: ' + rawText)
    }

    const billNumber = qrData.billNumber

    // Store pending payment for status polling
    pendingQRPayments.set(String(billNumber), {
      ...bookingData,
      invoiceId,
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
  const pending = pendingQRPayments.get(billNumber)

  if (!pending) {
    return res.status(404).json({ error: 'Payment session not found or expired' })
  }

  try {
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
    console.log(`[QR Status] billNumber=${billNumber} HTTP=${statusRes.status}: ${statusRaw}`)

    const statusData = JSON.parse(statusRaw)
    const status = statusData.status || 'UNKNOWN'

    // Create appointment exactly once when payment is confirmed
    if (status === 'PAID' && !pending.appointmentCreated) {
      pending.appointmentCreated = true
      try {
        const body = {
          data: {
            patient: pending.patientId,
            doctor: pending.doctorId,
            dateTime: pending.dateTime,
            type: pending.type,
            statuse: 'confirmed',
            price: pending.price,
            paymentStatus: 'paid',
            roomId: pending.roomId,
          },
        }
        await fetch(`${STRAPI_API_URL}/api/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${pending.userToken}`,
          },
          body: JSON.stringify(body),
        })
        console.log(`[QR] Appointment created for billNumber: ${billNumber}`)
        // Keep in map briefly so the frontend gets the PAID status on next poll
        setTimeout(() => pendingQRPayments.delete(billNumber), 60 * 1000)
      } catch (err) {
        console.error('[QR] appointment creation error:', err.message)
        pending.appointmentCreated = false // allow retry
      }
    }

    res.json({ status, billNumber })
  } catch (err) {
    console.error('[QR] status error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/payment/epay-callback  (ePay postLink — works in production)
app.post('/api/payment/epay-callback', (req, res) => {
  console.log('[ePay callback]', JSON.stringify(req.body))
  res.sendStatus(200)
})

// POST /api/payment/epay-failure-callback
app.post('/api/payment/epay-failure-callback', (req, res) => {
  console.log('[ePay failure callback]', JSON.stringify(req.body))
  res.sendStatus(200)
})

// POST /api/payment/epay-token
// Generates ePay OAuth token server-side (keeps ClientSecret secure)
app.post('/api/payment/epay-token', async (req, res) => {
  try {
    const { invoiceId, amount, currency = 'KZT' } = req.body
    if (!invoiceId || !amount) {
      return res.status(400).json({ error: 'invoiceId and amount required' })
    }
    const auth = await getEPayAuthToken(invoiceId, amount, currency)
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
  socket.on('join-room', ({ roomId, userId, userName, userRole, isPortrait }) => {
    console.log(`User ${userName} (${userId}) joining room ${roomId}`)

    // Создаём комнату если не существует
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
        messages: [],
      })
    }

    const room = rooms.get(roomId)

    // Добавляем участника
    room.participants.set(socket.id, {
      id: userId,
      name: userName,
      role: userRole,
      isPortrait: isPortrait ?? false,
      socketId: socket.id,
    })

    // Присоединяемся к комнате Socket.io
    socket.join(roomId)
    socket.roomId = roomId

    // Уведомляем других участников (включая ориентацию экрана)
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId,
      userName,
      userRole,
      isPortrait: isPortrait ?? false,
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
  })

  // WebRTC сигнализация - отправка offer
  socket.on('offer', ({ targetSocketId, offer }) => {
    console.log(`Offer from ${socket.id} to ${targetSocketId}`)
    io.to(targetSocketId).emit('offer', {
      senderSocketId: socket.id,
      offer,
    })
  })

  // WebRTC сигнализация - отправка answer
  socket.on('answer', ({ targetSocketId, answer }) => {
    console.log(`Answer from ${socket.id} to ${targetSocketId}`)
    io.to(targetSocketId).emit('answer', {
      senderSocketId: socket.id,
      answer,
    })
  })

  // WebRTC сигнализация - ICE candidate
  socket.on('ice-candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('ice-candidate', {
      senderSocketId: socket.id,
      candidate,
    })
  })

  // Чат в комнате
  socket.on('chat-message', ({ roomId, message, senderName }) => {
    const room = rooms.get(roomId)
    const participant = room?.participants.get(socket.id)
    const msgData = {
      id: Date.now(),
      message,
      senderName,
      senderId: socket.id,
      userId: participant?.id,
      timestamp: new Date().toISOString(),
    }
    // Сохраняем в историю комнаты
    if (room) {
      room.messages.push(msgData)
      if (room.messages.length > MAX_CHAT_HISTORY) {
        room.messages.shift()
      }
    }
    io.to(roomId).emit('chat-message', msgData)
  })

  // Переключение медиа (mute/unmute, video on/off)
  socket.on('media-toggle', ({ roomId, type, enabled }) => {
    socket.to(roomId).emit('user-media-toggle', {
      socketId: socket.id,
      type, // 'audio' или 'video'
      enabled,
    })
  })

  // Ориентация устройства (portrait/landscape)
  socket.on('orientation-update', ({ roomId, isPortrait }) => {
    socket.to(roomId).emit('remote-orientation-update', {
      socketId: socket.id,
      isPortrait,
    })
  })

  // Отключение
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    
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
  socket.on('force-end-call', ({ roomId }) => {
    socket.to(roomId).emit('call-force-ended')
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    timestamp: new Date().toISOString(),
  })
})

// Информация о комнате (для отладки)
app.get('/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId)
  if (!room) {
    return res.status(404).json({ error: 'Room not found' })
  }
  
  const participants = []
  room.participants.forEach((p, socketId) => {
    participants.push({ socketId, ...p })
  })
  
  res.json({
    roomId: room.id,
    participantsCount: participants.length,
    participants,
  })
})

// Локально signaling-сервер работает на 1341
// В продакшене на отдельном домене: https://medconnectrtc.nnmc.kz
const PORT = process.env.PORT || 1341

server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`)
})
