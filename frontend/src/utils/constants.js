// User Roles
export const ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  ADMIN: 'admin',
}

// Appointment Statuses
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

// Appointment Types
export const APPOINTMENT_TYPES = {
  VIDEO: 'video',
  CHAT: 'chat',
  IN_PERSON: 'in_person',
}

// Time Slots (default)
export const DEFAULT_TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '14:00', '14:30', '15:00', '15:30', '16:00',
  '16:30', '17:00', '17:30', '18:00',
]

// Specializations (common)
export const COMMON_SPECIALIZATIONS = [
  { id: 1, name: 'Терапевт', icon: 'stethoscope' },
  { id: 2, name: 'Кардиолог', icon: 'heart' },
  { id: 3, name: 'Невролог', icon: 'brain' },
  { id: 4, name: 'Дерматолог', icon: 'sparkles' },
  { id: 5, name: 'Гастроэнтеролог', icon: 'pill' },
  { id: 6, name: 'Офтальмолог', icon: 'eye' },
  { id: 7, name: 'Хирург', icon: 'scissors' },
  { id: 8, name: 'Педиатр', icon: 'baby' },
  { id: 9, name: 'Гинеколог', icon: 'user' },
  { id: 10, name: 'Уролог', icon: 'user' },
  { id: 11, name: 'Эндокринолог', icon: 'activity' },
  { id: 12, name: 'Психолог', icon: 'smile' },
]

// Navigation Items
export const PATIENT_NAV_ITEMS = [
  { path: '/patient', label: 'Главная', icon: 'home' },
  { path: '/patient/appointments', label: 'Мои записи', icon: 'calendar' },
  { path: '/patient/doctors', label: 'Врачи', icon: 'users' },
  { path: '/patient/chat', label: 'Сообщения', icon: 'message-circle' },
  { path: '/patient/documents', label: 'Документы', icon: 'file-text' },
  { path: '/patient/profile', label: 'Профиль', icon: 'user' },
]

export const DOCTOR_NAV_ITEMS = [
  { path: '/doctor', label: 'Главная', icon: 'home' },
  { path: '/doctor/schedule', label: 'Расписание', icon: 'calendar' },
  { path: '/doctor/patients', label: 'Пациенты', icon: 'users' },
  { path: '/doctor/chat', label: 'Сообщения', icon: 'message-circle' },
  { path: '/doctor/profile', label: 'Профиль', icon: 'user' },
]

export const ADMIN_NAV_ITEMS = [
  { path: '/admin', label: 'Дашборд', icon: 'layout-dashboard' },
  { path: '/admin/users', label: 'Пользователи', icon: 'users' },
  { path: '/admin/doctors', label: 'Врачи', icon: 'stethoscope' },
  { path: '/admin/appointments', label: 'Записи', icon: 'calendar' },
  { path: '/admin/specializations', label: 'Специализации', icon: 'tags' },
  { path: '/admin/settings', label: 'Контент сайта', icon: 'settings' },
]

// API Endpoints
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/local',
    REGISTER: '/api/auth/local/register',
    ME: '/api/users/me',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
  },
  APPOINTMENTS: '/api/appointments',
  DOCTORS: '/api/doctors',
  PATIENTS: '/api/patients',
  SPECIALIZATIONS: '/api/specializations',
  CONVERSATIONS: '/api/conversations',
  MESSAGES: '/api/messages',
  DOCUMENTS: '/api/medical-documents', // Изменено с documents на medical-documents
  TIME_SLOTS: '/api/time-slots',
  REVIEWS: '/api/reviews',
  UPLOAD: '/api/upload',
}

// Validation Rules
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_NAME_LENGTH: 50,
  IIN_LENGTH: 12,
  PHONE_LENGTH: 11,
}

// Error Messages
export const ERROR_MESSAGES = {
  REQUIRED: 'Это поле обязательно',
  INVALID_EMAIL: 'Неверный формат email',
  INVALID_PHONE: 'Неверный формат телефона',
  INVALID_IIN: 'ИИН должен содержать 12 цифр',
  PASSWORD_TOO_SHORT: `Пароль должен содержать минимум ${VALIDATION.MIN_PASSWORD_LENGTH} символов`,
  PASSWORDS_NOT_MATCH: 'Пароли не совпадают',
  NETWORK_ERROR: 'Ошибка сети. Проверьте подключение к интернету',
  SERVER_ERROR: 'Ошибка сервера. Попробуйте позже',
}
