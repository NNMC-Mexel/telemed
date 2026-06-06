import { create } from 'zustand'
import { notificationsAPI, normalizeResponse } from '../services/api'

const POLL_INTERVAL_MS = 30000

let audioCtx = null
let audioUnlocked = false

const unlockAudio = () => {
  if (audioUnlocked) return
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext
    if (!Ctor) return
    audioCtx = new Ctor()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    audioUnlocked = true
  } catch {
    /* no audio support — ignore */
  }
}

if (typeof window !== 'undefined') {
  const handler = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
  window.addEventListener('pointerdown', handler, { once: true })
  window.addEventListener('keydown', handler, { once: true })
}

const playBeep = () => {
  if (!audioCtx || audioCtx.state === 'suspended') return
  const now = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.exponentialRampToValueAtTime(1175, now + 0.12)
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.18, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
  osc.connect(gain).connect(audioCtx.destination)
  osc.start(now)
  osc.stop(now + 0.4)
}

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,
  pollTimer: null,
  visibilityBound: false,
  pushEventBound: false,
  hasFetchedOnce: false,

  fetch: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true, error: null })
    try {
      const res = await notificationsAPI.getAll(true, { limit: 50 })
      const { data } = normalizeResponse(res)
      const list = Array.isArray(data) ? data : []

      const prevIds = new Set(get().notifications.map((n) => n.documentId || n.id))
      const prevUnread = get().unreadCount
      const unread = list.filter((n) => !n.isRead).length

      const hasNewUnread = list.some(
        (n) => !n.isRead && !prevIds.has(n.documentId || n.id),
      )

      set({
        notifications: list,
        unreadCount: unread,
        isLoading: false,
        hasFetchedOnce: true,
      })

      // Sound only after first fetch (avoid beeping on initial load)
      // and only when we actually gained a new unread.
      if (get().hasFetchedOnce && hasNewUnread && unread > prevUnread) {
        playBeep()
      }
    } catch (error) {
      const status = error?.response?.status
      // 401/403 when logged out — silently stop; any other — surface
      if (status === 401 || status === 403) {
        set({ isLoading: false, notifications: [], unreadCount: 0 })
      } else {
        console.error('notifications fetch failed:', error)
        set({ isLoading: false, error: error.message })
      }
    }
  },

  startPolling: () => {
    if (get().pollTimer) return
    get().fetch({ silent: true })

    const tick = () => {
      if (document.visibilityState === 'visible') {
        get().fetch({ silent: true })
      }
    }
    const timer = setInterval(tick, POLL_INTERVAL_MS)
    set({ pollTimer: timer })

    if (!get().visibilityBound) {
      const onVisibility = () => {
        if (document.visibilityState === 'visible') {
          get().fetch({ silent: true })
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
      set({ visibilityBound: true })
    }

    if (!get().pushEventBound) {
      window.addEventListener('medconnect:push-notification-received', () => {
        get().fetch({ silent: true })
      })
      set({ pushEventBound: true })
    }
  },

  stopPolling: () => {
    const timer = get().pollTimer
    if (timer) clearInterval(timer)
    set({ pollTimer: null, notifications: [], unreadCount: 0, hasFetchedOnce: false })
  },

  markAsRead: async (documentId) => {
    if (!documentId) return
    const prev = get().notifications
    const next = prev.map((n) =>
      (n.documentId || n.id) === documentId ? { ...n, isRead: true } : n,
    )
    set({
      notifications: next,
      unreadCount: next.filter((n) => !n.isRead).length,
    })
    try {
      await notificationsAPI.markAsRead(documentId)
    } catch (error) {
      console.error('markAsRead failed:', error)
      set({ notifications: prev, unreadCount: prev.filter((n) => !n.isRead).length })
    }
  },

  markAllAsRead: async () => {
    const prev = get().notifications
    const next = prev.map((n) => ({ ...n, isRead: true }))
    set({ notifications: next, unreadCount: 0 })
    try {
      await notificationsAPI.markAllAsRead()
    } catch (error) {
      console.error('markAllAsRead failed:', error)
      set({ notifications: prev, unreadCount: prev.filter((n) => !n.isRead).length })
    }
  },

  remove: async (documentId) => {
    if (!documentId) return
    const prev = get().notifications
    const next = prev.filter((n) => (n.documentId || n.id) !== documentId)
    set({ notifications: next, unreadCount: next.filter((n) => !n.isRead).length })
    try {
      await notificationsAPI.remove(documentId)
    } catch (error) {
      console.error('remove notification failed:', error)
      set({ notifications: prev, unreadCount: prev.filter((n) => !n.isRead).length })
    }
  },
}))

export default useNotificationStore
