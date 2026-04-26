import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale/ru'
import { enUS } from 'date-fns/locale/en-US'
import { kk } from 'date-fns/locale/kk'

const getDateLocale = (lang) => {
  if (lang === 'en') return enUS
  if (lang === 'kk') return kk
  return ru
}

// Date formatting
// Second arg can be a lang code ('ru'|'en'|'kk') OR a format string for backward-compat.
export const formatDate = (date, langOrFormat = 'dd MMMM yyyy', extraFormat) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  const isLang = ['ru', 'en', 'kk'].includes(langOrFormat)
  const locale = isLang ? getDateLocale(langOrFormat) : ru
  const fmt = isLang ? (extraFormat || 'dd MMMM yyyy') : langOrFormat
  return format(parsed, fmt, { locale })
}

export const formatTime = (date) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return format(parsed, 'HH:mm', { locale: ru })
}

export const formatDateTime = (date, lang = 'ru') => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return format(parsed, 'dd MMM yyyy, HH:mm', { locale: getDateLocale(lang) })
}

export const formatRelativeDate = (date, lang = 'ru', labels = { today: 'Сегодня', tomorrow: 'Завтра', yesterday: 'Вчера' }) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date

  if (isToday(parsed)) return `${labels.today}, ${formatTime(parsed)}`
  if (isTomorrow(parsed)) return `${labels.tomorrow}, ${formatTime(parsed)}`
  if (isYesterday(parsed)) return `${labels.yesterday}, ${formatTime(parsed)}`

  return formatDateTime(parsed, lang)
}

export const formatTimeAgo = (date, lang = 'ru') => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(parsed, { addSuffix: true, locale: getDateLocale(lang) })
}

// Name formatting
export const getInitials = (name) => {
  if (!name) return '??'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const getFullName = (user) => {
  if (!user) return 'Неизвестный'
  if (user.fullName) return user.fullName
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Неизвестный'
}

// Phone formatting
export const formatPhone = (phone) => {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `+7 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`
  }
  return phone
}

// Status formatting
export const appointmentStatusMap = {
  pending: { label: 'Ожидает', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Подтверждено', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'В процессе', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Завершено', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Отменено', color: 'bg-red-100 text-red-800' },
  no_show: { label: 'Звонок не состоялся', color: 'bg-orange-100 text-orange-800' },
}

export const getStatusInfo = (status) => {
  return appointmentStatusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' }
}

// Price formatting
export const formatPrice = (price) => {
  return new Intl.NumberFormat('ru-KZ', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 0,
  }).format(price)
}

// Get localised specialization name from API object (uses nameEn / nameKk from Strapi)
export const getSpecName = (spec, lang) => {
  if (!spec) return ''
  const name = typeof spec === 'object' ? spec.name : spec
  if (!name) return ''
  if (lang === 'en') return (typeof spec === 'object' && spec.nameEn) || name
  if (lang === 'kk') return (typeof spec === 'object' && spec.nameKk) || name
  return name
}

// ClassNames helper
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ')
}

// Generate unique ID
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9)
}

// Debounce function
export const debounce = (func, wait) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func.apply(this, args), wait)
  }
}

// Validation helpers
export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const isValidPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length === 11
}

export const isValidIIN = (iin) => {
  return /^\d{12}$/.test(iin)
}

// Check if doctor is currently within working hours
export const isDoctorOnline = (doctor) => {
  if (doctor.isActive === false) return false

  const now = new Date()
  const currentDay = now.getDay() // 0=Sun, 1=Mon, ...

  // Check working days
  if (doctor.workingDays) {
    const days = typeof doctor.workingDays === 'string'
      ? doctor.workingDays.split(',').map(Number).filter(n => !isNaN(n))
      : doctor.workingDays
    if (!days.includes(currentDay)) return false
  }

  // Check working hours
  const startTime = doctor.workStartTime
  const endTime = doctor.workEndTime
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = sh * 60 + sm
    const endMinutes = eh * 60 + em
    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) return false
  }

  // Check break time
  const breakStart = doctor.breakStart
  const breakEnd = doctor.breakEnd
  if (breakStart && breakEnd) {
    const [bsh, bsm] = breakStart.split(':').map(Number)
    const [beh, bem] = breakEnd.split(':').map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const breakStartMinutes = bsh * 60 + bsm
    const breakEndMinutes = beh * 60 + bem
    if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) return false
  }

  return true
}
