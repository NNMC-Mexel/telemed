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

      // Register - отправляем только разрешённые поля
      register: async (userData) => {
        set({ isLoading: true, error: null })
        try {
          // Strapi по умолчанию принимает только username, email, password
          // Остальные поля добавим после регистрации
          const response = await api.post('/api/auth/local/register', {
            username: userData.email,
            email: userData.email,
            password: userData.password,
          })
          
          const { jwt, user } = response.data
          
          // Определяем роль пользователя
          const userRole = userData.userRole || 'patient'
          
          // Теперь обновляем профиль с дополнительными полями
          try {
            await api.put(`/api/users/${user.id}`, {
              fullName: userData.fullName,
              phone: userData.phone,
              userRole: userRole,
            }, {
              headers: { Authorization: `Bearer ${jwt}` }
            })
            user.fullName = userData.fullName
            user.phone = userData.phone
            user.userRole = userRole
          } catch (e) {
            console.log('Could not update extra fields:', e)
          }
          
          // Если регистрируется врач - создаём профиль врача
          if (userRole === 'doctor') {
            try {
              const doctorData = {
                fullName: userData.fullName,
                users_permissions_user: user.id, // Связь с пользователем
                userId: user.id, // Дополнительное поле для упрощения фильтрации
                isActive: true,
                rating: 0,
                reviewsCount: 0,
                price: 8000, // Цена по умолчанию
                experience: userData.doctorData?.experience || 0,
                bio: userData.doctorData?.education || '', // Используем bio вместо education
                workStartTime: '09:00',
                workEndTime: '18:00',
                breakStart: '12:00',
                breakEnd: '14:00',
                slotDuration: 30,
                workingDays: '1,2,3,4,5', // Пн-Пт по умолчанию
              }
              
              // Если есть специализация - добавляем
              if (userData.doctorData?.specialization) {
                doctorData.specialization = parseInt(userData.doctorData.specialization)
              }
              
              await api.post('/api/doctors', { data: doctorData }, {
                headers: { Authorization: `Bearer ${jwt}` }
              })
              console.log('Doctor profile created successfully')
            } catch (e) {
              console.log('Could not create doctor profile:', e.response?.data || e)
            }
          }
          
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
