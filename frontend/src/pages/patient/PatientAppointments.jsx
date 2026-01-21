import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  Video,
  MessageCircle,
  Filter,
  Search,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import useAuthStore from '../../stores/authStore'
import useAppointmentStore from '../../stores/appointmentStore'
import { formatRelativeDate, formatPrice, formatDate } from '../../utils/helpers'
import { getMediaUrl } from '../../services/api'

const statusLabels = {
  pending: 'Ожидает подтверждения',
  confirmed: 'Подтверждено',
  completed: 'Завершено',
  cancelled: 'Отменено',
}

// Уведомление о результате отмены
const CancelResultNotification = ({ show, refundable, amount, onClose }) => {
  if (!show) return null
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fadeIn">
      <div className={`bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl ${refundable ? 'border-2 border-green-200' : 'border-2 border-rose-200'}`}>
        <div className="text-center">
          <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${refundable ? 'bg-green-100' : 'bg-rose-100'}`}>
            {refundable ? (
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Запись отменена</h3>
          <p className={`text-sm ${refundable ? 'text-green-600' : 'text-rose-600'}`}>
            {refundable 
              ? `Сумма ${amount?.toLocaleString()} ₸ будет возвращена на ваш счёт`
              : 'Возврат средств невозможен (менее 12 часов до приёма)'
            }
          </p>
          <button
            onClick={onClose}
            className={`mt-6 w-full py-2.5 rounded-xl font-medium text-white ${refundable ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-600 hover:bg-slate-700'}`}
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  )
}

const statusVariants = {
  pending: 'default',
  confirmed: 'primary',
  completed: 'success',
  cancelled: 'danger',
}

function PatientAppointments() {
  const { user } = useAuthStore()
  const { appointments, fetchAppointments, cancelAppointment, isLoading, error } = useAppointmentStore()
  
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState({ show: false, refundable: false, amount: 0 })

  useEffect(() => {
    if (user?.id) {
      fetchAppointments({ patient: user.id })
    }
  }, [user?.id])

  // Функция для проверки, прошла ли запись (более 1 часа назад)
  const isAppointmentPast = (dateTime) => {
    const appointmentDate = new Date(dateTime)
    const oneHourAfter = new Date(appointmentDate.getTime() + 60 * 60 * 1000)
    return new Date() > oneHourAfter
  }

  const filteredAppointments = appointments.filter(apt => {
    const isPast = isAppointmentPast(apt.dateTime)
    
    // Фильтр по статусу
    if (filter === 'upcoming') {
      // Предстоящие - только если не отменена и не прошла более часа назад
      return ['pending', 'confirmed'].includes(apt.status) && !isPast
    }
    if (filter === 'completed') {
      // Завершённые - или статус completed, или прошло более часа
      return apt.status === 'completed' || 
             (['pending', 'confirmed'].includes(apt.status) && isPast)
    }
    if (filter === 'cancelled') {
      return apt.status === 'cancelled'
    }
    
    // Поиск
    if (searchQuery) {
      const doctorName = apt.doctor?.fullName?.toLowerCase() || ''
      const specName = typeof apt.doctor?.specialization === 'object' 
        ? apt.doctor.specialization?.name?.toLowerCase()
        : (apt.doctor?.specialization || '').toLowerCase()
      return doctorName.includes(searchQuery.toLowerCase()) || 
             specName.includes(searchQuery.toLowerCase())
    }
    
    return true
  }).sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return
    
    setIsCancelling(true)
    try {
      const refundInfo = calculateRefund(selectedAppointment)
      await cancelAppointment(
        selectedAppointment.id, 
        selectedAppointment.documentId,
        refundInfo
      )
      setShowCancelModal(false)
      setSelectedAppointment(null)
      
      // Показываем красивое уведомление
      setCancelResult({
        show: true,
        refundable: refundInfo.refundable,
        amount: refundInfo.amount
      })
    } catch (err) {
      console.error('Error cancelling appointment:', err)
    } finally {
      setIsCancelling(false)
    }
  }

  const openCancelModal = (appointment) => {
    setSelectedAppointment(appointment)
    setShowCancelModal(true)
  }

  // Расчёт возврата: за 12+ часов - полный возврат, меньше - без возврата
  const calculateRefund = (appointment) => {
    if (!appointment) return { refundable: false, amount: 0, hoursLeft: 0 }
    
    const appointmentDate = new Date(appointment.dateTime)
    const now = new Date()
    const hoursUntilAppointment = (appointmentDate - now) / (1000 * 60 * 60)
    const price = appointment.price || appointment.doctor?.price || 0
    
    if (hoursUntilAppointment >= 12) {
      return { 
        refundable: true, 
        amount: price, 
        hoursLeft: Math.floor(hoursUntilAppointment),
        message: 'Полный возврат средств'
      }
    } else {
      return { 
        refundable: false, 
        amount: 0, 
        hoursLeft: Math.floor(hoursUntilAppointment),
        message: 'Возврат невозможен (менее 12 часов до приёма)'
      }
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Мои записи</h1>
          <p className="text-slate-600">История и предстоящие консультации</p>
        </div>
        <Link to="/doctors">
          <Button rightIcon={<ChevronRight className="w-4 h-4" />}>
            Записаться к врачу
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по врачу или специализации..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {[
            { value: 'all', label: 'Все' },
            { value: 'upcoming', label: 'Предстоящие' },
            { value: 'completed', label: 'Завершённые' },
            { value: 'cancelled', label: 'Отменённые' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                filter === value
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      ) : filteredAppointments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Нет записей</h3>
            <p className="text-slate-600 mb-4">
              {filter !== 'all' 
                ? 'Нет записей с выбранным фильтром' 
                : 'У вас пока нет записей к врачам'}
            </p>
            <Link to="/doctors">
              <Button>Записаться к врачу</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => {
            const doctorName = appointment.doctor?.fullName || 'Врач'
            const specName = typeof appointment.doctor?.specialization === 'object'
              ? appointment.doctor.specialization?.name
              : appointment.doctor?.specialization || ''
            
            const appointmentDate = new Date(appointment.dateTime)
            const now = new Date()
            
            // Запись считается прошедшей если прошёл 1 час с момента начала
            const oneHourAfterAppointment = new Date(appointmentDate.getTime() + 60 * 60 * 1000)
            const isPastAppointment = now > oneHourAfterAppointment
            
            // Статус "upcoming" только если запись не прошедшая
            const isUpcoming = ['confirmed', 'pending'].includes(appointment.status) && !isPastAppointment
            
            // Можно подключиться: за 15 минут до начала и не позже 1 часа после начала
            const fifteenMinBefore = new Date(appointmentDate.getTime() - 15 * 60 * 1000)
            const canJoin = ['confirmed', 'pending'].includes(appointment.status) && 
                           now >= fifteenMinBefore && 
                           now <= oneHourAfterAppointment

            return (
              <Card key={appointment.id} hover>
                <CardContent>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Doctor Info */}
                    <div className="flex items-center gap-4">
                      <Avatar
                        src={getMediaUrl(appointment.doctor?.photo)}
                        name={doctorName}
                        size="xl"
                      />
                      <div>
                        <h3 className="font-semibold text-slate-900">{doctorName}</h3>
                        <p className="text-teal-600 text-sm">{specName}</p>
                        <div className="flex items-center gap-3 mt-2 text-sm text-slate-500">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(appointment.dateTime)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(appointment.dateTime).toLocaleTimeString('ru-RU', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status and Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={isPastAppointment && appointment.status !== 'cancelled' ? 'success' : statusVariants[appointment.status]}>
                          {isPastAppointment && appointment.status !== 'cancelled' ? 'Завершено' : statusLabels[appointment.status]}
                        </Badge>
                        <Badge variant="default">
                          {appointment.type === 'video' ? (
                            <><Video className="w-3 h-3 mr-1" />Видео</>
                          ) : (
                            <><MessageCircle className="w-3 h-3 mr-1" />Чат</>
                          )}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {formatPrice(appointment.price || appointment.doctor?.price || 0)}
                        </span>
                        
                        {canJoin && appointment.roomId && (
                          <Link to={`/consultation/${appointment.roomId}`}>
                            <Button size="sm" leftIcon={<Video className="w-4 h-4" />}>
                              Подключиться
                            </Button>
                          </Link>
                        )}
                        
                        {isUpcoming && (
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={() => openCancelModal(appointment)}
                          >
                            Отменить
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {appointment.symptoms && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-600">
                        <span className="font-medium">Жалобы:</span> {appointment.symptoms}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Отмена записи"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Нет, оставить
            </Button>
            <Button 
              variant="danger" 
              onClick={handleCancelAppointment}
              isLoading={isCancelling}
            >
              Да, отменить
            </Button>
          </>
        }
      >
        {(() => {
          const refund = calculateRefund(selectedAppointment)
          return (
        <div className="text-center py-4">
              <AlertCircle className={`w-12 h-12 mx-auto mb-4 ${refund.refundable ? 'text-amber-500' : 'text-rose-500'}`} />
          <p className="text-slate-600">
            Вы уверены, что хотите отменить запись к врачу{' '}
            <span className="font-semibold">{selectedAppointment?.doctor?.fullName}</span>?
          </p>
          {selectedAppointment && (
            <p className="text-sm text-slate-500 mt-2">
              {formatDate(selectedAppointment.dateTime)} в{' '}
              {new Date(selectedAppointment.dateTime).toLocaleTimeString('ru-RU', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          )}
              
              {/* Информация о возврате */}
              <div className={`mt-4 p-4 rounded-xl ${refund.refundable ? 'bg-green-50 border border-green-200' : 'bg-rose-50 border border-rose-200'}`}>
                <p className={`font-medium ${refund.refundable ? 'text-green-700' : 'text-rose-700'}`}>
                  {refund.refundable ? '✓ ' : '✗ '}{refund.message}
                </p>
                {refund.refundable && (
                  <p className="text-green-600 text-sm mt-1">
                    Сумма возврата: {formatPrice(refund.amount)}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-2">
                  До приёма осталось: {refund.hoursLeft > 0 ? `${refund.hoursLeft} ч.` : 'менее часа'}
                </p>
              </div>
              
              {/* Политика отмены */}
              <p className="text-xs text-slate-400 mt-4">
                Политика отмены: при отмене за 12+ часов до приёма — полный возврат, менее 12 часов — без возврата.
              </p>
        </div>
          )
        })()}
      </Modal>

      {/* Уведомление о результате отмены */}
      <CancelResultNotification
        show={cancelResult.show}
        refundable={cancelResult.refundable}
        amount={cancelResult.amount}
        onClose={() => setCancelResult({ show: false, refundable: false, amount: 0 })}
      />
    </div>
  )
}

export default PatientAppointments
