import { create } from "zustand";
import {
    appointmentsAPI,
    doctorsAPI,
    specializationsAPI,
    timeSlotsAPI,
    normalizeResponse,
} from "../services/api";

const useAppointmentStore = create((set, get) => ({
    appointments: [],
    currentAppointment: null,
    doctors: [],
    specializations: [],
    timeSlots: [],
    isLoading: false,
    error: null,

    // Fetch user appointments
    fetchAppointments: async (filters = {}) => {
        set({ isLoading: true, error: null });
        try {
            const response = await appointmentsAPI.getAll(filters);
            const { data } = normalizeResponse(response);
            set({ appointments: data || [], isLoading: false });
        } catch (error) {
            console.error("Error fetching appointments:", error);
            set({ error: error.message, isLoading: false, appointments: [] });
        }
    },

    // Create appointment
    createAppointment: async (appointmentData) => {
        set({ isLoading: true, error: null });
        try {
            const response = await appointmentsAPI.create(appointmentData);
            const { data } = normalizeResponse(response);

            set((state) => ({
                appointments: [data, ...state.appointments],
                isLoading: false,
            }));

            return { success: true, data };
        } catch (error) {
            const message =
                error.response?.data?.error?.message ||
                "Ошибка создания записи";
            set({ error: message, isLoading: false });
            return { success: false, error: message };
        }
    },

    // Update appointment
    updateAppointment: async (id, data) => {
        set({ isLoading: true, error: null });
        try {
            const response = await appointmentsAPI.update(id, data);
            const { data: updatedData } = normalizeResponse(response);

            set((state) => ({
                appointments: state.appointments.map((apt) =>
                    apt.id === id ? updatedData : apt
                ),
                isLoading: false,
            }));

            return { success: true };
        } catch (error) {
            set({ error: error.message, isLoading: false });
            return { success: false, error: error.message };
        }
    },

    // Cancel appointment with refund calculation
    cancelAppointment: async (id, documentId, refundInfo = null) => {
        try {
            // Используем documentId для Strapi v5
            const idToUse = documentId || id;
            await appointmentsAPI.cancel(idToUse);

            set((state) => ({
                appointments: state.appointments.map((apt) =>
                    (apt.id === id || apt.documentId === documentId) 
                        ? { 
                            ...apt, 
                            status: "cancelled",
                            refundStatus: refundInfo?.refundable ? 'refunded' : 'no_refund',
                            refundAmount: refundInfo?.amount || 0
                          } 
                        : apt
                ),
            }));

            return { success: true, refundInfo };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Booked slots for booking modal
    bookedSlots: [],
    
    fetchBookedSlots: async (doctorId, date) => {
        set({ isLoading: true });
        try {
            const response = await appointmentsAPI.getBookedSlots(doctorId, date);
            const { data } = normalizeResponse(response);
            // Извлекаем только время из dateTime для забронированных слотов
            const bookedTimes = (data || []).map(apt => 
                new Date(apt.dateTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
            );
            set({ bookedSlots: bookedTimes, isLoading: false });
            return bookedTimes;
        } catch (error) {
            console.error("Error fetching booked slots:", error);
            set({ error: error.message, isLoading: false, bookedSlots: [] });
            return [];
        }
    },

    // Fetch doctors
    fetchDoctors: async (params = {}) => {
        set({ isLoading: true });
        try {
            const response = await doctorsAPI.getAll(params);
            const { data } = normalizeResponse(response);
            set({ doctors: data || [], isLoading: false });
        } catch (error) {
            console.error("Error fetching doctors:", error);
            set({ error: error.message, isLoading: false, doctors: [] });
        }
    },

    // Fetch single doctor
    fetchDoctor: async (id) => {
        set({ isLoading: true });
        try {
            const response = await doctorsAPI.getOne(id);
            const { data } = normalizeResponse(response);
            return data;
        } catch (error) {
            console.error("Error fetching doctor:", error);
            set({ isLoading: false });
            return null;
        } finally {
            set({ isLoading: false });
        }
    },

    // Fetch specializations
    fetchSpecializations: async () => {
        set({ isLoading: true });
        try {
            const response = await specializationsAPI.getAll();
            const { data } = normalizeResponse(response);
            set({ specializations: data || [], isLoading: false });
        } catch (error) {
            console.error("Error fetching specializations:", error);
            set({
                error: error.message,
                isLoading: false,
                specializations: [],
            });
        }
    },

    // Fetch available time slots
    fetchTimeSlots: async (doctorId, date) => {
        set({ isLoading: true });
        try {
            const response = await timeSlotsAPI.getAvailable(doctorId, date);
            const { data } = normalizeResponse(response);
            set({ timeSlots: data || [], isLoading: false });
            return data || [];
        } catch (error) {
            console.error("Error fetching time slots:", error);
            set({ error: error.message, isLoading: false, timeSlots: [] });
            return [];
        }
    },

    // Set current appointment (for video call)
    setCurrentAppointment: (appointment) =>
        set({ currentAppointment: appointment }),

    // Clear error
    clearError: () => set({ error: null }),

    // Reset store
    reset: () =>
        set({
            appointments: [],
            currentAppointment: null,
            doctors: [],
            specializations: [],
            timeSlots: [],
            isLoading: false,
            error: null,
        }),
}));

export default useAppointmentStore;
