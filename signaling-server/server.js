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
  return process.env.FRONTEND_URL 
    ? [process.env.FRONTEND_URL]
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:1342'];
};

const corsOptions = {
  origin: getCorsOrigin(),
  methods: ['GET', 'POST'],
  credentials: true,
}

app.use(cors(corsOptions))

// Socket.io сервер
const io = new Server(server, {
  cors: corsOptions,
})

// Хранение комнат и участников
const rooms = new Map()

// Структура комнаты:
// {
//   id: string,
//   participants: Map<socketId, { id, name, role }>
// }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)

  // Присоединение к комнате
  socket.on('join-room', ({ roomId, userId, userName, userRole }) => {
    console.log(`User ${userName} (${userId}) joining room ${roomId}`)
    
    // Создаём комнату если не существует
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        participants: new Map(),
      })
    }
    
    const room = rooms.get(roomId)
    
    // Добавляем участника
    room.participants.set(socket.id, {
      id: userId,
      name: userName,
      role: userRole,
      socketId: socket.id,
    })
    
    // Присоединяемся к комнате Socket.io
    socket.join(roomId)
    socket.roomId = roomId
    
    // Уведомляем других участников
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      userId,
      userName,
      userRole,
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
    io.to(roomId).emit('chat-message', {
      id: Date.now(),
      message,
      senderName,
      senderId: socket.id,
      timestamp: new Date().toISOString(),
    })
  })

  // Переключение медиа (mute/unmute, video on/off)
  socket.on('media-toggle', ({ roomId, type, enabled }) => {
    socket.to(roomId).emit('user-media-toggle', {
      socketId: socket.id,
      type, // 'audio' или 'video'
      enabled,
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
