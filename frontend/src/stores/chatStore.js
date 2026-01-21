import { create } from 'zustand'
import { 
  conversationsAPI, 
  messagesAPI, 
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
      
      set((state) => ({
        messages: [...state.messages, data],
      }))
      
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

  // Create or get conversation with user
  getOrCreateConversation: async (participantIds) => {
    set({ isLoading: true })
    try {
      // Создаём новую беседу
      const response = await conversationsAPI.create(participantIds)
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

  // Add message to local state (for real-time updates)
  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }))
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
