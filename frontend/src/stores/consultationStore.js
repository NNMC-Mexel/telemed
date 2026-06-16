import { create } from 'zustand'

const useConsultationStore = create((set) => ({
  activeRoomId: null,
  isMinimized: false,

  openConsultation: (roomId) => set({
    activeRoomId: roomId,
    isMinimized: false,
  }),

  minimizeConsultation: () => set({ isMinimized: true }),
  restoreConsultation: () => set({ isMinimized: false }),
  closeConsultation: () => set({
    activeRoomId: null,
    isMinimized: false,
  }),
}))

export default useConsultationStore
