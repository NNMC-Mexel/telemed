import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

// Date formatting
export const formatDate = (date, formatStr = 'dd MMMM yyyy') => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return format(parsed, formatStr, { locale: ru })
}

export const formatTime = (date) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return format(parsed, 'HH:mm', { locale: ru })
}

export const formatDateTime = (date) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return format(parsed, 'dd MMM yyyy, HH:mm', { locale: ru })
}

export const formatRelativeDate = (date) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  
  if (isToday(parsed)) return `Сегодня, ${formatTime(parsed)}`
  if (isTomorrow(parsed)) return `Завтра, ${formatTime(parsed)}`
  if (isYesterday(parsed)) return `Вчера, ${formatTime(parsed)}`
  
  return formatDateTime(parsed)
}

export const formatTimeAgo = (date) => {
  const parsed = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(parsed, { addSuffix: true, locale: ru })
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
