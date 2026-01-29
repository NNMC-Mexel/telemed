import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import api, { authAPI } from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      // Set hydrated flag
      setHasHydrated: (state) => {
        set({ _hasHydrated: state })
      },

      // Login
      login: async (identifier, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await authAPI.login(identifier, password)
          
          const { jwt, user } = response.data
          
          set({
            user,
            token: jwt,
            isAuthenticated: true,
            isLoading: false,
          })
          
          return { success: true, user }
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Ошибка входа'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      // Register — один вызов, backend (strapi-server.ts) обрабатывает:
      //   - назначение Strapi-роли (patient/doctor)
      //   - сохранение fullName, phone, iin, userRole
      //   - создание Doctor-профиля (если doctor)
      register: async (userData) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/api/auth/local/register', {
            username: userData.email,
            email: userData.email,
            password: userData.password,
            userRole: userData.userRole || 'patient',
            fullName: userData.fullName,
            phone: userData.phone,
            iin: userData.iin,
            doctorData: userData.doctorData || null,
          })

          const { jwt, user } = response.data

          set({
            user,
            token: jwt,
            isAuthenticated: true,
            isLoading: false,
          })

          return { success: true, user }
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Ошибка регистрации'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      // Logout
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        })
      },

      // Get current user
      fetchUser: async () => {
        const token = get().token
        if (!token) return
        
        set({ isLoading: true })
        try {
          const response = await authAPI.getMe()
          set({ 
            user: response.data, 
            isAuthenticated: true,
            isLoading: false 
          })
        } catch (error) {
          console.error('fetchUser error:', error)
          set({ isLoading: false })
          // Не разлогиниваем сразу - возможно сервер просто недоступен
          if (error.response?.status === 401) {
            get().logout()
          }
        }
      },

      // Update user profile
      updateProfile: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const userId = get().user?.id
          const token = get().token
          const response = await api.put(`/api/users/${userId}`, data, {
            headers: { Authorization: `Bearer ${token}` }
          })
          set({ user: response.data, isLoading: false })
          return { success: true }
        } catch (error) {
          const message = error.response?.data?.error?.message || 'Ошибка обновления'
          set({ error: message, isLoading: false })
          return { success: false, error: message }
        }
      },

      // Get user role (используем userRole из Strapi)
      getUserRole: () => {
        const user = get().user
        return user?.userRole || 'patient'
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        token: state.token, 
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        // Восстанавливаем isAuthenticated из сохранённого состояния
        if (state?.token && state?.user) {
          state.isAuthenticated = true
        }
      },
    }
  )
)

export default useAuthStore
