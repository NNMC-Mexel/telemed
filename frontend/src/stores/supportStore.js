import { create } from 'zustand'
import { supportAPI, messagesAPI, normalizeResponse } from '../services/api'

const STAFF_ROLES = ['admin', 'manager']

export const isStaffMessage = (message) =>
  STAFF_ROLES.includes(message?.sender?.userRole)

/**
 * Стор виджета чата поддержки (сторона пациента).
 * Один «вечный» тред на пользователя: get-or-create при первом открытии.
 */
const useSupportStore = create((set, get) => ({
  conversation: null,
  messages: [],
  isOpen: false,
  isLoading: false,
  isSending: false,
  unreadCount: 0,
  error: null,

  // Получает (или создаёт) support-тред и подтягивает сообщения
  init: async (userId) => {
    if (get().isLoading) return
    set({ isLoading: true, error: null })
    try {
      const response = await supportAPI.getOrCreateConversation()
      const { data } = normalizeResponse(response)
      set({ conversation: data })
      await get().fetchMessages(userId)
    } catch (error) {
      console.error('Error initializing support chat:', error)
      set({ error: error.message })
    } finally {
      set({ isLoading: false })
    }
  },

  // Обновляет сообщения + статус треда (для поллинга)
  refresh: async (userId) => {
    const { conversation } = get()
    if (!conversation?.id) return
    try {
      const response = await supportAPI.getOrCreateConversation()
      const { data } = normalizeResponse(response)
      set({ conversation: data })
    } catch {
      // не критично — статус обновится при следующем поллинге
    }
    await get().fetchMessages(userId)
  },

  fetchMessages: async (userId) => {
    const { conversation } = get()
    if (!conversation?.id) return
    try {
      const response = await messagesAPI.getByConversation(conversation.id)
      const { data } = normalizeResponse(response)
      const sorted = (data || []).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      )
      const unread = sorted.filter(
        (m) => !m.isRead && m.sender?.id && m.sender.id !== userId
      ).length
      set({ messages: sorted, unreadCount: unread })
    } catch (error) {
      console.error('Error fetching support messages:', error)
    }
  },

  send: async (content, attachmentIds = []) => {
    const { conversation } = get()
    if (!conversation?.id || get().isSending) return { success: false }
    set({ isSending: true })
    try {
      const payload = { conversation: conversation.id, content }
      if (attachmentIds.length > 0) payload.attachments = attachmentIds
      const response = await messagesAPI.create(payload)
      const { data } = normalizeResponse(response)
      // Дедупликация: socket-событие о своём сообщении могло прийти раньше REST-ответа
      get().appendMessage(data, data?.sender?.id ?? null)
      return { success: true, data }
    } catch (error) {
      console.error('Error sending support message:', error)
      return { success: false, error: error.message }
    } finally {
      set({ isSending: false })
    }
  },

  // Сообщение из realtime-события (с дедупликацией против REST/own send)
  appendMessage: (message, currentUserId) => {
    if (!message) return
    set((state) => {
      const exists = state.messages.some(
        (m) =>
          (message.documentId && m.documentId === message.documentId) ||
          (message.id && m.id === message.id)
      )
      if (exists) return {}
      const fromOther = message.sender?.id && message.sender.id !== currentUserId
      return {
        messages: [...state.messages, message],
        unreadCount: fromOther ? state.unreadCount + 1 : state.unreadCount,
      }
    })
  },

  setConversationStatus: (supportStatus) => {
    set((state) =>
      state.conversation ? { conversation: { ...state.conversation, supportStatus } } : {}
    )
  },

  markRead: async () => {
    const { conversation, unreadCount } = get()
    if (!conversation?.documentId || unreadCount === 0) return
    try {
      await supportAPI.markConversationRead(conversation.documentId)
      set((state) => ({
        unreadCount: 0,
        messages: state.messages.map((m) => ({ ...m, isRead: true })),
      }))
    } catch (error) {
      console.error('Error marking support messages as read:', error)
    }
  },

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  reset: () =>
    set({
      conversation: null,
      messages: [],
      isOpen: false,
      isLoading: false,
      isSending: false,
      unreadCount: 0,
      error: null,
    }),
}))

export default useSupportStore
