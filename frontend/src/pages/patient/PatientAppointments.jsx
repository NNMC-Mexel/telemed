import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Calendar,
  Clock,
  Video,
  MessageCircle,
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  AlertCircle,
  FileText,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import useAuthStore from '../../stores/authStore'
import useAppointmentStore from '../../stores/appointmentStore'
import { formatPrice, formatDate, getSpecName } from '../../utils/helpers'
import { getMediaUrl, getServerNow } from '../../services/api'
import { DOCUMENT_STATUS, getAppointmentPreparation } from '../../utils/appointmentPreparation'

const ITEMS_PER_PAGE = 10
const REFUND_CUTOFF_HOURS = 24
const JOINABLE_APPOINTMENT_STATUSES = ['pending', 'confirmed', 'in_progress']

const statusVariants = {
  pending: 'default',
  confirmed: 'primary',
  in_progress: 'success',
  completed: 'success',
  cancelled: 'danger',
  no_show: 'warning',
}

const getPreparationLabel = (preparation, t) => {
  if (preparation.status === 'ready') return t('appointments.prep_ready')
  if (preparation.status === 'no_documents') return t('appointments.prep_no_documents')
  if (preparation.status === 'access_missing') return t('appointments.prep_access_missing')
  if (preparation.status === 'will_upload_later') return t('appointments.prep_later')
  return t('appointments.prep_not_ready')
}

const CancelResultNotification = ({ show, refundable, amount, onClose, t }) => {
  if (!show) return null
  return (
    <div className="safe-modal-viewport fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn">
      <div className={`safe-modal-panel overflow-y-auto bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl ${refundable ? 'border-2 border-green-200' : 'border-2 border-rose-200'}`}>
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
          <h3 className="text-lg font-semibold text-slate-900 mb-2">{t('appointments.cancelled_title')}</h3>
          <p className={`text-sm ${refundable ? 'text-green-600' : 'text-rose-600'}`}>
            {refundable
              ? t('appointments.refund_amount_msg', { amount: amount?.toLocaleString() + ' ₸' })
              : t('appointments.no_refund_msg')}
          </p>
          <button
            onClick={onClose}
            className={`mt-6 w-full py-2.5 rounded-xl font-medium text-white ${refundable ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-600 hover:bg-slate-700'}`}
          >
            {t('appointments.got_it')}
          </button>
        </div>
      </div>
    </div>
  )
}

function PatientAppointments() {
  const { t, i18n } = useTranslation()
  const timeLocale = i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-US' : 'ru-RU'
  const { user } = useAuthStore()
  const { appointments, fetchAppointments, cancelAppointment, isLoading, error } = useAppointmentStore()

  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelResult, setCancelResult] = useState({ show: false, refundable: false, amount: 0 })

  const statusLabels = {
    pending: t('appointment.status_pending'),
    confirmed: t('appointment.status_confirmed'),
    in_progress: t('appointment.status_in_progress'),
    completed: t('appointment.status_completed'),
    cancelled: t('appointment.status_cancelled'),
    no_show: t('appointment.status_no_show'),
  }

  useEffect(() => {
    if (user?.id) fetchAppointments()
  }, [user?.id])

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, searchQuery, dateFrom, dateTo])

  const isAppointmentPast = (appointment) => {
    const appointmentDate = new Date(appointment.dateTime)
    const consultationDuration = appointment.doctor?.consultationDuration || 30
    const consultationEnd = new Date(appointmentDate.getTime() + (consultationDuration + 5) * 60 * 1000)
    return getServerNow() > consultationEnd || appointment.status === 'completed'
  }

  const getEffectiveStatus = (appointment) => {
    if (['confirmed', 'pending', 'in_progress'].includes(appointment.status) && isAppointmentPast(appointment)) {
      return 'no_show'
    }
    return appointment.status
  }

  const filteredAppointments = appointments.filter(apt => {
    const isPast = isAppointmentPast(apt)

    // Status filter
    if (filter === 'upcoming') {
      if (!(JOINABLE_APPOINTMENT_STATUSES.includes(apt.status) && !isPast)) return false
    } else if (filter === 'completed') {
      if (!(
        ['completed', 'no_show'].includes(apt.status) ||
        (JOINABLE_APPOINTMENT_STATUSES.includes(apt.status) && isPast)
      )) return false
    } else if (filter === 'cancelled') {
      if (apt.status !== 'cancelled') return false
    }

    // Search filter (always applied, regardless of status filter)
    if (searchQuery) {
      const doctorName = apt.doctor?.fullName?.toLowerCase() || ''
      const specName = getSpecName(apt.doctor?.specialization, i18n.language).toLowerCase()
      if (!doctorName.includes(searchQuery.toLowerCase()) && !specName.includes(searchQuery.toLowerCase())) {
        return false
      }
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom)
      from.setHours(0, 0, 0, 0)
      if (new Date(apt.dateTime) < from) return false
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      if (new Date(apt.dateTime) > to) return false
    }

    return true
  }).sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))

  const totalPages = Math.ceil(filteredAppointments.length / ITEMS_PER_PAGE)
  const paginatedAppointments = filteredAppointments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const hasDateFilter = dateFrom || dateTo

  const handleCancelAppointment = async () => {
    if (!selectedAppointment) return
    setIsCancelling(true)
    try {
      const refundInfo = calculateRefund(selectedAppointment)
      const result = await cancelAppointment(selectedAppointment.id, selectedAppointment.documentId, refundInfo)
      if (!result?.success) throw new Error(result?.error || 'Cancel failed')
      const refunded = result.data?.paymentStatus === 'refunded'
      setShowCancelModal(false)
      setSelectedAppointment(null)
      setCancelResult({ show: true, refundable: refunded, amount: refunded ? refundInfo.amount : 0 })
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

  const calculateRefund = (appointment) => {
    if (!appointment) return { refundable: false, amount: 0, hoursLeft: 0 }
    const appointmentDate = new Date(appointment.dateTime)
    const now = new Date()
    const hoursUntilAppointment = (appointmentDate - now) / (1000 * 60 * 60)
    const price = appointment.price || appointment.doctor?.price || 0
    if (hoursUntilAppointment >= REFUND_CUTOFF_HOURS) {
      return { refundable: true, amount: price, hoursLeft: Math.floor(hoursUntilAppointment), message: t('appointments.refund_full') }
    }
    return { refundable: false, amount: 0, hoursLeft: Math.floor(hoursUntilAppointment), message: t('appointments.no_refund_info') }
  }

  const filterOptions = [
    { value: 'all', label: t('appointments.filter_all') },
    { value: 'upcoming', label: t('appointments.filter_upcoming') },
    { value: 'completed', label: t('appointments.filter_completed') },
    { value: 'cancelled', label: t('appointments.filter_cancelled') },
  ]

  // Build page number list with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = []
    if (currentPage <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages)
    } else if (currentPage >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
    } else {
      pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages)
    }
    return pages
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('nav.appointments')}</h1>
          <p className="text-slate-600">{t('appointments.subtitle')}</p>
        </div>
        <Link to="/doctors">
          <Button rightIcon={<ChevronRight className="w-4 h-4" />}>
            {t('appointments.book')}
          </Button>
        </Link>
      </div>

      {/* Search + Status filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder={t('appointments.search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {filterOptions.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                filter === value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 whitespace-nowrap">{t('appointments.date_from')}:</span>
          <input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
            className="text-sm text-slate-700 focus:outline-none bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-500 whitespace-nowrap">{t('appointments.date_to')}:</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
            className="text-sm text-slate-700 focus:outline-none bg-transparent"
          />
        </div>
        {hasDateFilter && (
          <button
            onClick={() => { setDateFrom(''); setDateTo('') }}
            className="flex items-center gap-1 text-sm text-rose-500 hover:text-rose-600 transition-colors"
          >
            <X className="w-4 h-4" />
            {t('appointments.reset_dates')}
          </button>
        )}
        {filteredAppointments.length > 0 && (
          <span className="ml-auto text-sm text-slate-500">
            {t('appointments.showing', {
              from: (currentPage - 1) * ITEMS_PER_PAGE + 1,
              to: Math.min(currentPage * ITEMS_PER_PAGE, filteredAppointments.length),
              total: filteredAppointments.length,
            })}
          </span>
        )}
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
            <h3 className="text-lg font-medium text-slate-900 mb-2">{t('appointments.empty_title')}</h3>
            <p className="text-slate-600 mb-4">
              {filter !== 'all' || hasDateFilter || searchQuery
                ? t('appointments.empty_filtered')
                : t('appointments.empty_all')}
            </p>
            <Link to="/doctors">
              <Button>{t('appointments.book')}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {paginatedAppointments.map((appointment) => {
              const doctorName = appointment.doctor?.fullName || t('appointments.doctor_label')
              const specName = getSpecName(appointment.doctor?.specialization, i18n.language)

              const appointmentDate = new Date(appointment.dateTime)
              const now = getServerNow()
              const consultationDuration = appointment.doctor?.consultationDuration || 30
              const consultationEnd = new Date(appointmentDate.getTime() + (consultationDuration + 5) * 60 * 1000)
              const isPastAppointment = now > consultationEnd || appointment.status === 'completed'
              const isUpcoming = JOINABLE_APPOINTMENT_STATUSES.includes(appointment.status) && !isPastAppointment
              const effectiveStatus = getEffectiveStatus(appointment)
              const fifteenMinBefore = new Date(appointmentDate.getTime() - 15 * 60 * 1000)
              const canJoin = JOINABLE_APPOINTMENT_STATUSES.includes(appointment.status) &&
                             now >= fifteenMinBefore &&
                             now <= consultationEnd
              const preparation = getAppointmentPreparation(appointment)

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
                              {formatDate(appointment.dateTime, i18n.language)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {new Date(appointment.dateTime).toLocaleTimeString(timeLocale, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Status and Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariants[effectiveStatus] ?? 'default'}>
                            {statusLabels[effectiveStatus] ?? effectiveStatus}
                          </Badge>
                          <Badge variant="default">
                            {appointment.type === 'video' ? (
                              <><Video className="w-3 h-3 mr-1" />{t('appointment.type_video')}</>
                            ) : (
                              <><MessageCircle className="w-3 h-3 mr-1" />{t('appointment.type_chat')}</>
                            )}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {formatPrice(appointment.price || appointment.doctor?.price || 0)}
                          </span>

                          {canJoin && appointment.roomId ? (
                            <Link to={`/consultation/${appointment.roomId}`}>
                              <Button size="sm" leftIcon={<Video className="w-4 h-4" />}>
                                {t('appointments.connect')}
                              </Button>
                            </Link>
                          ) : ['completed', 'no_show'].includes(effectiveStatus) ? (
                            <Link to={`/patient/appointments/${appointment.documentId || appointment.id}`}>
                              <Button size="sm" variant="secondary" leftIcon={<FileText className="w-4 h-4" />}>
                                {t('appointments.details')}
                              </Button>
                            </Link>
                          ) : null}

                          {isUpcoming && !canJoin && (
                            <Button variant="secondary" size="sm" onClick={() => openCancelModal(appointment)}>
                              {t('appointments.cancel_button')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {appointment.symptoms && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">{t('appointments.symptoms_label')}:</span> {appointment.symptoms}
                        </p>
                      </div>
                    )}

                    {isUpcoming && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {t('appointments.prep_title')}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {getPreparationLabel(preparation, t)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              to={`/patient/appointments/${appointment.documentId || appointment.id}#documents`}
                              title={t('appointments.prep_docs_action')}
                              aria-label={t('appointments.prep_docs_action')}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                              preparation.documentsReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            } ${
                              preparation.documentsReady ? 'hover:bg-emerald-100' : 'hover:bg-amber-100'
                            }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              {preparation.documentsStatus === DOCUMENT_STATUS.NO_DOCUMENTS
                                ? t('appointments.prep_docs_none')
                                : preparation.documentsReady
                                ? t('appointments.prep_docs_ready')
                                : t('appointments.prep_docs_waiting')}
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                            <Link
                              to={`/patient/appointments/${appointment.documentId || appointment.id}#access`}
                              title={t('appointments.prep_access_action')}
                              aria-label={t('appointments.prep_access_action')}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${
                              preparation.accessReady ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            } ${
                              preparation.accessReady ? 'hover:bg-emerald-100' : 'hover:bg-slate-200'
                            }`}
                            >
                              {preparation.accessReady ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <ShieldCheck className="w-3.5 h-3.5" />
                              )}
                              {preparation.accessReady
                                ? t('appointments.prep_access_ready')
                                : t('appointments.prep_access_waiting')}
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 pt-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label={t('appointments.page_prev')}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {getPageNumbers().map((page, idx) =>
                page === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 select-none">…</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-9 h-9 px-2 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label={t('appointments.page_next')}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Cancel Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title={t('appointments.cancel_modal_title')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              {t('appointments.cancel_keep')}
            </Button>
            <Button variant="danger" onClick={handleCancelAppointment} isLoading={isCancelling}>
              {t('appointments.cancel_do')}
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
                {t('appointments.cancel_question')}{' '}
                <span className="font-semibold">{selectedAppointment?.doctor?.fullName}</span>?
              </p>
              {selectedAppointment && (
                <p className="text-sm text-slate-500 mt-2">
                  {formatDate(selectedAppointment.dateTime, i18n.language)}{' '}
                  {new Date(selectedAppointment.dateTime).toLocaleTimeString(timeLocale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              )}
              <div className={`mt-4 p-4 rounded-xl ${refund.refundable ? 'bg-green-50 border border-green-200' : 'bg-rose-50 border border-rose-200'}`}>
                <p className={`font-medium ${refund.refundable ? 'text-green-700' : 'text-rose-700'}`}>
                  {refund.refundable ? '✓ ' : '✗ '}{refund.message}
                </p>
                {refund.refundable && (
                  <p className="text-green-600 text-sm mt-1">
                    {t('appointments.refund_amount_label')}: {formatPrice(refund.amount)}
                  </p>
                )}
                <p className="text-slate-500 text-xs mt-2">
                  {t('appointments.hours_left')}: {refund.hoursLeft > 0
                    ? t('appointments.time_left_hours', { hours: refund.hoursLeft })
                    : t('appointments.less_hour')}
                </p>
              </div>
              <p className="text-xs text-slate-400 mt-4">{t('appointments.cancel_policy')}</p>
            </div>
          )
        })()}
      </Modal>

      <CancelResultNotification
        show={cancelResult.show}
        refundable={cancelResult.refundable}
        amount={cancelResult.amount}
        onClose={() => setCancelResult({ show: false, refundable: false, amount: 0 })}
        t={t}
      />
    </div>
  )
}

export default PatientAppointments
