import { io } from 'socket.io-client'
import { getApiBaseUrl } from './api'

/**
 * Realtime-клиент (socket.io) к Strapi-серверу.
 * Один сокет на приложение; авторизация JWT из auth-storage.
 *
 * События сервера:
 *  - message:new          — новое сообщение в подписанной беседе
 *  - conversation:status  — смена статуса support-обращения
 *  - support:inbox        — инбокс поддержки изменился (для staff)
 */

let socket = null
let socketToken = null

const readToken = () => {
  try {
    const raw = localStorage.getItem('auth-storage')
    return raw ? JSON.parse(raw)?.state?.token || null : null
  } catch {
    return null
  }
}

export function getSocket() {
  const token = readToken()
  if (!token) return null

  // Токен сменился (перелогин) — пересоздаём соединение
  if (socket && socketToken !== token) {
    socket.disconnect()
    socket = null
  }

  if (!socket) {
    socketToken = token
    socket = io(getApiBaseUrl(), {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnectionDelay: 2000,
      reconnectionDelayMax: 15000,
    })
  }

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
    socketToken = null
  }
}

/**
 * Подписка на беседу: join + слушатели. Возвращает функцию отписки.
 * handlers: { onMessage(msg), onStatus({ conversation, supportStatus }) }
 */
export function subscribeToConversation(documentId, handlers = {}) {
  const s = getSocket()
  if (!s || !documentId) return () => {}

  const join = () => s.emit('conversation:join', documentId)
  join()
  // После реконнекта комнаты теряются — переподписываемся
  s.on('connect', join)

  const onMessage = (msg) => {
    if (msg?.conversation === documentId) handlers.onMessage?.(msg)
  }
  const onStatus = (payload) => {
    if (payload?.conversation === documentId) handlers.onStatus?.(payload)
  }
  if (handlers.onMessage) s.on('message:new', onMessage)
  if (handlers.onStatus) s.on('conversation:status', onStatus)

  return () => {
    s.off('connect', join)
    if (handlers.onMessage) s.off('message:new', onMessage)
    if (handlers.onStatus) s.off('conversation:status', onStatus)
    s.emit('conversation:leave', documentId)
  }
}

/** Подписка staff на изменения инбокса поддержки. Возвращает функцию отписки. */
export function subscribeToSupportInbox(onChange) {
  const s = getSocket()
  if (!s) return () => {}
  s.on('support:inbox', onChange)
  return () => s.off('support:inbox', onChange)
}
