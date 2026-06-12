import { create } from 'zustand'
import {
  conversationsAPI,
  messagesAPI,
  supportAPI,
  normalizeResponse
} from '../services/api'

const useChatStore = create((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  error: null,

  // Fetch all conversations for user
  fetchConversations: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await conversationsAPI.getAll(userId)
      const { data } = normalizeResponse(response)
      set({ conversations: data || [], isLoading: false })
    } catch (error) {
      console.error('Error fetching conversations:', error)
      set({ error: error.message, isLoading: false, conversations: [] })
    }
  },

  // Fetch messages for a conversation
  fetchMessages: async (conversationId) => {
    set({ isLoading: true, error: null })
    try {
      const response = await messagesAPI.getByConversation(conversationId)
      const { data } = normalizeResponse(response)
      // Сортируем по времени (старые сначала)
      const sortedMessages = (data || []).sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      )
      set({ messages: sortedMessages, isLoading: false })
    } catch (error) {
      console.error('Error fetching messages:', error)
      set({ error: error.message, isLoading: false, messages: [] })
    }
  },

  // Send message
  sendMessage: async (conversationId, content, senderId) => {
    try {
      const response = await messagesAPI.create({
        conversation: conversationId,
        content,
        sender: senderId,
      })
      
      const { data } = normalizeResponse(response)

      // Через addMessage: socket-событие о своём же сообщении может прийти
      // раньше REST-ответа — дедупликация защищает от дублей
      get().addMessage(data)
      
      // Обновляем lastMessage в conversation
      try {
        await conversationsAPI.update(conversationId, {
          lastMessage: { content, createdAt: new Date().toISOString() },
        })
      } catch (e) {
        console.log('Could not update conversation lastMessage:', e)
      }
      
      return { success: true, data }
    } catch (error) {
      console.error('Error sending message:', error)
      return { success: false, error: error.message }
    }
  },

  // Create or get conversation with user (no duplicates)
  getOrCreateConversation: async (participantIds, currentUserId, appointmentId = null) => {
    set({ isLoading: true })
    try {
      // Ищем существующий диалог с этим участником
      const { conversations } = get()
      const otherIds = participantIds.filter(id => id !== currentUserId)
      const existing = conversations.find(conv => {
        const members = (conv.participants || conv.users_permissions_users || []).map(p => p.id)
        const appointmentRef = conv.appointment?.documentId || conv.appointment?.id
        const matchesAppointment = appointmentId
          ? String(appointmentRef || '') === String(appointmentId)
          : true
        return matchesAppointment && otherIds.every(id => members.includes(id))
      })

      if (existing) {
        set({ currentConversation: existing, isLoading: false })
        return existing
      }

      if (!appointmentId) {
        throw new Error('appointment is required to create a conversation')
      }

      // Создаём новую беседу только если не нашли существующую
      const response = await conversationsAPI.create(participantIds, appointmentId)
      const { data } = normalizeResponse(response)

      set((state) => ({
        currentConversation: data,
        conversations: [data, ...state.conversations],
        isLoading: false
      }))

      return data
    } catch (error) {
      console.error('Error creating conversation:', error)
      set({ error: error.message, isLoading: false })
      return null
    }
  },

  // Set current conversation
  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation })
  },

  // Add message to local state (for real-time updates), с дедупликацией
  addMessage: (message) => {
    if (!message) return
    set((state) => {
      const exists = state.messages.some(
        (m) =>
          (message.documentId && m.documentId === message.documentId) ||
          (message.id && m.id === message.id)
      )
      return exists ? {} : { messages: [...state.messages, message] }
    })
  },

  // Открыть (или создать) тред службы поддержки текущего пользователя
  openSupport: async () => {
    const { conversations } = get()
    const existing = conversations.find((c) => c.type === 'support')
    if (existing) {
      set({ currentConversation: existing })
      return existing
    }
    try {
      const response = await supportAPI.getOrCreateConversation()
      const { data } = normalizeResponse(response)
      set((state) => ({
        currentConversation: data,
        conversations: [data, ...state.conversations],
      }))
      return data
    } catch (error) {
      console.error('Error opening support conversation:', error)
      return null
    }
  },

  // Mark messages as read
  markAsRead: async (messageId) => {
    try {
      await messagesAPI.markAsRead(messageId)
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  },

  // Clear messages
  clearMessages: () => set({ messages: [], currentConversation: null }),

  // Clear error
  clearError: () => set({ error: null }),
  
  // Reset store
  reset: () => set({
    conversations: [],
    currentConversation: null,
    messages: [],
    isLoading: false,
    error: null,
  }),
}))

export default useChatStore
