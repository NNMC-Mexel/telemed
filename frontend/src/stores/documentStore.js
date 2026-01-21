import { create } from 'zustand'
import { documentsAPI, normalizeResponse, uploadFile } from '../services/api'

const useDocumentStore = create((set, get) => ({
  documents: [],
  currentDocument: null,
  isLoading: false,
  isUploading: false,
  error: null,

  // Fetch user documents
  fetchDocuments: async (params = {}) => {
    set({ isLoading: true, error: null })
    try {
      const response = await documentsAPI.getAll(params)
      const { data } = normalizeResponse(response)
      set({ documents: data || [], isLoading: false })
    } catch (error) {
      console.error('Error fetching documents:', error)
      set({ error: error.message, isLoading: false, documents: [] })
    }
  },

  // Get single document
  fetchDocument: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const response = await documentsAPI.getOne(id)
      const { data } = normalizeResponse(response)
      set({ currentDocument: data, isLoading: false })
      return data
    } catch (error) {
      console.error('Error fetching document:', error)
      set({ error: error.message, isLoading: false })
      return null
    }
  },

  // Upload document
  uploadDocument: async (file, metadata) => {
    set({ isUploading: true, error: null })
    try {
      // 1. Загружаем файл в Media Library
      const uploadedFile = await uploadFile(file)
      
      // 2. Создаём запись документа
      const response = await documentsAPI.create({
        title: metadata.title || file.name,
        type: metadata.type || 'other',
        description: metadata.description || '',
        file: uploadedFile.id,
        user: metadata.userId,
        doctor: metadata.doctorId || null,
        appointment: metadata.appointmentId || null,
        isPrivate: metadata.isPrivate || false,
      })
      
      const { data } = normalizeResponse(response)
      
      set((state) => ({
        documents: [data, ...state.documents],
        isUploading: false,
      }))
      
      return { success: true, data }
    } catch (error) {
      console.error('Error uploading document:', error)
      const message = error.response?.data?.error?.message || 'Ошибка загрузки документа'
      set({ error: message, isUploading: false })
      return { success: false, error: message }
    }
  },

  // Update document
  updateDocument: async (id, data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await documentsAPI.update(id, data)
      const { data: updatedData } = normalizeResponse(response)
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedData : doc
        ),
        isLoading: false,
      }))
      
      return { success: true }
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return { success: false, error: error.message }
    }
  },

  // Delete document
  deleteDocument: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await documentsAPI.delete(id)
      
      set((state) => ({
        documents: state.documents.filter((doc) => doc.id !== id),
        isLoading: false,
      }))
      
      return { success: true }
    } catch (error) {
      set({ error: error.message, isLoading: false })
      return { success: false, error: error.message }
    }
  },

  // Set current document
  setCurrentDocument: (document) => set({ currentDocument: document }),

  // Clear error
  clearError: () => set({ error: null }),

  // Reset store
  reset: () => set({
    documents: [],
    currentDocument: null,
    isLoading: false,
    isUploading: false,
    error: null,
  }),
}))

export default useDocumentStore
