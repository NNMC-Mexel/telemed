import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search,
  Calendar,
  Video,
  MessageCircle,
  ChevronDown,
  Loader2,
  AlertCircle,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  PlayCircle,
  CreditCard,
  Filter,
  Download,
  ExternalLink,
  UserPlus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import { useToast } from '../../components/ui/Toast'
import AdminCreateUserModal from '../../components/admin/AdminCreateUserModal'
import api, { normalizeResponse, getMediaUrl } from '../../services/api'
import { formatDateTime, formatPrice, formatDate } from '../../utils/helpers'

const STATUS_VARIANTS = {
  pending:     { variant: 'warning',  icon: Clock },
  confirmed:   { variant: 'primary',  icon: CheckCircle },
  in_progress: { variant: 'info',     icon: PlayCircle },
  completed:   { variant: 'success',  icon: CheckCircle },
  cancelled:   { variant: 'danger',   icon: XCircle },
}

const STATUS_NEXT = {
  pending:     ['confirmed', 'cancelled'],
  confirmed:   ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
}

const PAYMENT_VARIANTS = {
  pending:  'warning',
  paid:     'success',
  failed:   'danger',
  refunded: 'default',
}

const TYPE_ICONS = {
  video: Video,
  chat:  MessageCircle,
}

const APPOINTMENTS_PER_PAGE = 10

const getAppointmentDocumentId = (appointment) => appointment?.documentId || appointment?.id

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 sm:w-12 sm:h-12 ${color}`}>
            <Icon className="w-5 h-5 text-white sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0 w-full">
            <p className="text-xl sm:text-2xl font-bold leading-tight text-slate-900 break-words">{value}</p>
            <p className="text-sm leading-snug text-slate-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }) {
  const { t } = useTranslation()
  const labels = {
    pending:     t('admin_apt.status_pending'),
    confirmed:   t('admin_apt.status_confirmed'),
    in_progress: t('admin_apt.status_in_progress'),
    completed:   t('admin_apt.status_completed'),
    cancelled:   t('admin_apt.status_cancelled'),
  }
  const cfg = STATUS_VARIANTS[status] || { variant: 'default' }
  return <Badge variant={cfg.variant}>{labels[status] || status}</Badge>
}

function PaymentBadge({ status }) {
  const { t } = useTranslation()
  const labels = {
    pending:  t('admin_apt.payment_pending'),
    paid:     t('admin_apt.payment_paid'),
    failed:   t('admin_apt.payment_failed'),
    refunded: t('admin_apt.payment_refunded'),
  }
  return <Badge variant={PAYMENT_VARIANTS[status] || 'default'}>{labels[status] || status}</Badge>
}

function StatusDropdown({ appointment, onSelect }) {
  const [open, setOpen] = useState(false)
  const next = STATUS_NEXT[appointment.status] || []
  if (next.length === 0) return <StatusBadge status={appointment.status} />
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1 focus:outline-none">
        <StatusBadge status={appointment.status} />
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
            {next.map(status => (
              <button
                key={status}
                onClick={() => { setOpen(false); onSelect(status) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
              >
                <StatusBadge status={status} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PaymentDropdown({ appointment, onChange }) {
  const [open, setOpen] = useState(false)
  const current = appointment.paymentStatus || 'pending'
  const statuses = ['pending', 'paid', 'failed', 'refunded']
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="inline-flex items-center gap-1 focus:outline-none">
        <PaymentBadge status={current} />
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[150px]">
            {statuses.filter(s => s !== current).map(status => (
              <button
                key={status}
                onClick={() => { setOpen(false); onChange(appointment, status) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
              >
                <PaymentBadge status={status} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AppointmentDetailModal({ appointment: apt, onClose, onStatusChange, onPaymentChange }) {
  const { t } = useTranslation()
  const TypeIcon = TYPE_ICONS[apt.type] || Video
  const next = STATUS_NEXT[apt.status] || []

  const fields = [
    { label: t('admin_apt.field_datetime'), value: formatDateTime(apt.dateTime) },
    { label: t('admin_apt.field_type'), value: <span className="inline-flex items-center gap-1.5"><TypeIcon className="w-4 h-4" />{t(`admin_apt.type_${apt.type}`) || apt.type}</span> },
    { label: 'Room ID', value: <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{apt.roomId || '—'}</code> },
    { label: t('admin_apt.field_amount'), value: apt.price ? formatPrice(apt.price) : '—' },
  ]

  return (
    <Modal isOpen onClose={onClose} title={t('admin_apt.detail_title')} size="lg">
      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('admin_apt.participants_patient')}</p>
            <div className="flex items-center gap-3">
              <Avatar name={apt.patient?.fullName || 'П'} size="md" />
              <div>
                <p className="font-semibold text-slate-900">{apt.patient?.fullName || t('admin_apt.unknown_patient')}</p>
                <p className="text-sm text-slate-500">{apt.patient?.email || '—'}</p>
                <p className="text-sm text-slate-500">{apt.patient?.phone || '—'}</p>
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t('admin_apt.participants_doctor')}</p>
            <div className="flex items-center gap-3">
              <Avatar name={apt.doctor?.fullName || 'В'} size="md" />
              <div>
                <p className="font-semibold text-slate-900">{apt.doctor?.fullName || '—'}</p>
                <p className="text-sm text-slate-500">{apt.doctor?.specialization?.name || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {fields.map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm font-medium text-slate-900">{value}</span>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('admin_apt.col_status_label')}</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={apt.status} />
              {next.map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-teal-500 hover:text-teal-600 transition-colors"
                >
                  → <StatusBadge status={s} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{t('admin_apt.payment_status_label')}</p>
            <div className="flex flex-wrap gap-2">
              <PaymentBadge status={apt.paymentStatus} />
              {['pending', 'paid', 'failed', 'refunded']
                .filter(s => s !== apt.paymentStatus)
                .map(s => (
                  <button
                    key={s}
                    onClick={() => onPaymentChange(s)}
                    className="text-xs px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-teal-500 hover:text-teal-600 transition-colors"
                  >
                    → <PaymentBadge status={s} />
                  </button>
                ))
              }
            </div>
          </div>
        </div>

        {(apt.symptoms || apt.notes) && (
          <div className="space-y-3">
            {apt.symptoms && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('admin_apt.symptoms_label')}</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{apt.symptoms}</p>
              </div>
            )}
            {apt.notes && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{t('admin_apt.notes_label')}</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{apt.notes}</p>
              </div>
            )}
          </div>
        )}

        {apt.roomId && (apt.status === 'confirmed' || apt.status === 'in_progress') && (
          <Button variant="outline" className="w-full" onClick={() => window.open(`/consultation/${apt.roomId}`, '_blank')}>
            <ExternalLink className="w-4 h-4 mr-2" />
            {t('admin_apt.open_room_btn')}
          </Button>
        )}
      </div>
    </Modal>
  )
}

function AdminAppointments() {
  const { t } = useTranslation()
  const toast = useToast()

  const [appointments, setAppointments] = useState([])
  const [isLoading, setIsLoading]       = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')

  const [detailAppointment, setDetailAppointment] = useState(null)
  const [statusModal, setStatusModal] = useState({ open: false, appointment: null, newStatus: null })
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const statusFilters = [
    { value: 'all',         label: t('admin_apt.filter_all') },
    { value: 'pending',     label: t('admin_apt.filter_pending') },
    { value: 'confirmed',   label: t('admin_apt.filter_confirmed') },
    { value: 'in_progress', label: t('admin_apt.filter_in_progress') },
    { value: 'completed',   label: t('admin_apt.filter_completed') },
    { value: 'cancelled',   label: t('admin_apt.filter_cancelled') },
  ]

  const paymentFilters = [
    { value: 'all',      label: t('admin_apt.pay_filter_all') },
    { value: 'pending',  label: t('admin_apt.pay_filter_pending') },
    { value: 'paid',     label: t('admin_apt.pay_filter_paid') },
    { value: 'failed',   label: t('admin_apt.pay_filter_failed') },
    { value: 'refunded', label: t('admin_apt.pay_filter_refunded') },
  ]

  const nextStatusLabels = {
    confirmed:   t('admin_apt.action_confirm'),
    in_progress: t('admin_apt.action_start'),
    completed:   t('admin_apt.action_complete'),
    cancelled:   t('admin_apt.action_cancel'),
  }

  const fetchAppointments = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const query = new URLSearchParams()
      query.append('populate[doctor][populate][0]', 'specialization')
      query.append('populate[doctor][populate][1]', 'photo')
      query.append('populate[patient][fields][0]', 'id')
      query.append('populate[patient][fields][1]', 'fullName')
      query.append('populate[patient][fields][2]', 'email')
      query.append('populate[patient][fields][3]', 'phone')
      query.append('sort', 'dateTime:desc')
      query.append('pagination[limit]', '1000')

      const res = await api.get(`/api/appointments?${query}`)
      const { data } = normalizeResponse(res)
      setAppointments(data || [])
    } catch (err) {
      console.error('Error fetching appointments:', err)
      toast.error(t('admin_apt.err_load'))
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [t, toast])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  const filtered = appointments.filter((apt) => {
    if (statusFilter  !== 'all' && apt.status        !== statusFilter)  return false
    if (paymentFilter !== 'all' && apt.paymentStatus !== paymentFilter) return false
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
    if (search) {
      const q = search.toLowerCase()
      return (
        apt.patient?.fullName?.toLowerCase().includes(q) ||
        apt.patient?.email?.toLowerCase().includes(q)   ||
        apt.doctor?.fullName?.toLowerCase().includes(q) ||
        apt.roomId?.toLowerCase().includes(q)
      )
    }
    return true
  })

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, paymentFilter, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / APPOINTMENTS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedAppointments = filtered.slice(
    (safeCurrentPage - 1) * APPOINTMENTS_PER_PAGE,
    safeCurrentPage * APPOINTMENTS_PER_PAGE
  )

  const stats = {
    total:   appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    today:   appointments.filter(a => {
      const d = new Date(a.dateTime)
      const now = new Date()
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length,
    revenue: appointments.filter(a => a.paymentStatus === 'paid').reduce((sum, a) => sum + (a.price || 0), 0),
  }

  const openStatusModal = (apt, newStatus) => setStatusModal({ open: true, appointment: apt, newStatus })

  const confirmStatusChange = async () => {
    const { appointment, newStatus } = statusModal
    if (!appointment || !newStatus) return
    setIsSaving(true)
    try {
      const appointmentDocumentId = getAppointmentDocumentId(appointment)
      const response = await api.put(`/api/appointments/${appointmentDocumentId}`, { data: { statuse: newStatus } })
      const updated = response?.data?.data
      if (!updated) throw new Error('Appointment update returned empty response')

      setAppointments(prev =>
        prev.map(a => a.id === appointment.id ? { ...a, ...updated, status: updated.statuse || newStatus } : a)
      )
      if (detailAppointment?.id === appointment.id) {
        setDetailAppointment(prev => ({ ...prev, ...updated, status: updated.statuse || newStatus }))
      }
      toast.success(`→ ${newStatus}`)
      setStatusModal({ open: false, appointment: null, newStatus: null })
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error(t('admin_apt.err_status'))
    } finally {
      setIsSaving(false)
    }
  }

  const handlePaymentStatusChange = async (apt, newPaymentStatus) => {
    try {
      const appointmentDocumentId = getAppointmentDocumentId(apt)
      const response = await api.put(`/api/appointments/${appointmentDocumentId}`, { data: { paymentStatus: newPaymentStatus } })
      const updated = response?.data?.data
      if (!updated) throw new Error('Appointment payment update returned empty response')

      setAppointments(prev => prev.map(a => a.id === apt.id ? { ...a, ...updated, status: updated.statuse || a.status } : a))
      if (detailAppointment?.id === apt.id) {
        setDetailAppointment(prev => ({ ...prev, ...updated, status: updated.statuse || prev.status }))
      }
      toast.success(t('admin_apt.success_payment'))
    } catch (err) {
      console.error('Error updating payment status:', err)
      toast.error(t('admin_apt.err_payment'))
    }
  }

  const exportCSV = () => {
    const rows = [
      ['ID', t('admin_apt.col_patient'), 'Email', t('admin_apt.col_doctor'), t('admin_apt.col_datetime'), t('admin_apt.col_status'), t('admin_apt.col_payment'), t('admin_apt.col_amount'), t('admin_apt.col_type')],
      ...filtered.map(a => [
        a.id,
        a.patient?.fullName || '',
        a.patient?.email   || '',
        a.doctor?.fullName  || '',
        formatDateTime(a.dateTime),
        a.status,
        a.paymentStatus,
        a.price || 0,
        a.type,
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `appointments_${formatDate(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin_apt.title')}</h1>
          <p className="text-slate-600">{t('admin_apt.subtitle')}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap">
          <Button className="w-full" variant="outline" size="sm" onClick={() => setIsPatientModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            {t('admin_apt.add_patient_btn')}
          </Button>
          <Button className="w-full" variant="outline" size="sm" onClick={() => fetchAppointments(true)} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('admin_apt.refresh_btn')}
          </Button>
          <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1.5" />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard icon={Calendar}    label={t('admin_apt.stat_total')}   value={stats.total}            color="bg-gradient-to-br from-teal-500 to-sky-500" />
        <StatCard icon={Clock}       label={t('admin_apt.stat_today')}   value={stats.today}            color="bg-gradient-to-br from-amber-500 to-orange-500" />
        <StatCard icon={AlertCircle} label={t('admin_apt.stat_pending')} value={stats.pending}          color="bg-gradient-to-br from-violet-500 to-purple-500" />
        <StatCard icon={CreditCard}  label={t('admin_apt.stat_revenue')} value={formatPrice(stats.revenue)} color="bg-gradient-to-br from-emerald-500 to-teal-500" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder={t('admin_apt.search_placeholder')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {statusFilters.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    statusFilter === value ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {label}
                  {value !== 'all' && (
                    <span className="ml-1.5 opacity-70">
                      {appointments.filter(a => a.status === value).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {paymentFilters.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-[auto_1fr] items-center gap-2 text-sm text-slate-500 sm:flex">
                <span>{t('admin_apt.from_label')}</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
                <span>{t('admin_apt.to_label')}</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo('') }}
                    className="col-span-2 text-left text-rose-500 hover:text-rose-700 text-xs font-medium sm:col-span-1"
                  >
                    {t('admin_apt.reset_dates')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">{t('admin_apt.empty')}</p>
              <p className="text-sm mt-1">{t('admin_apt.empty_hint')}</p>
            </div>
          ) : (
            <>
            <div className="divide-y divide-slate-100 md:hidden">
              {paginatedAppointments.map((apt) => {
                const TypeIcon = TYPE_ICONS[apt.type] || Video
                const next = STATUS_NEXT[apt.status] || []
                return (
                  <div key={apt.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('admin_apt.col_patient')}</p>
                        <p className="font-medium text-slate-900 wrap-break-word">
                          {apt.patient?.fullName || t('admin_apt.unknown_patient')}
                        </p>
                        <p className="text-sm text-slate-500 wrap-break-word">{apt.patient?.email || '—'}</p>
                      </div>
                      <Button variant="secondary" size="icon" title={t('admin_apt.details_btn')} onClick={() => setDetailAppointment(apt)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={getMediaUrl(apt.doctor?.photo)} name={apt.doctor?.fullName || 'В'} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('admin_apt.col_doctor')}</p>
                          <p className="text-sm font-medium text-slate-900 wrap-break-word">{apt.doctor?.fullName || '—'}</p>
                          <p className="text-xs text-slate-500">{apt.doctor?.specialization?.name || '—'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3 text-sm min-[420px]:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-400">{t('admin_apt.col_datetime')}</p>
                          <p className="font-medium text-slate-900 break-words">{formatDateTime(apt.dateTime)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{t('admin_apt.col_type')}</p>
                          <p className="inline-flex items-center gap-1.5 text-slate-700">
                            <TypeIcon className="w-4 h-4" />
                            {t(`admin_apt.type_${apt.type}`) || apt.type}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{t('admin_apt.col_amount')}</p>
                          <p className="font-semibold text-slate-900">{apt.price ? formatPrice(apt.price) : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">{t('admin_apt.col_payment')}</p>
                          <div className="min-w-0">
                            <PaymentDropdown appointment={apt} onChange={handlePaymentStatusChange} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {next.length > 0 ? (
                        <StatusDropdown appointment={apt} onSelect={(newStatus) => openStatusModal(apt, newStatus)} />
                      ) : (
                        <StatusBadge status={apt.status} />
                      )}
                      {apt.roomId && (apt.status === 'confirmed' || apt.status === 'in_progress') && (
                        <Button variant="secondary" size="icon" title={t('admin_apt.open_room_icon')} onClick={() => window.open(`/consultation/${apt.roomId}`, '_blank')}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_apt.col_patient')}</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_apt.col_doctor')}</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_apt.col_datetime')}</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_apt.col_type')}</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_apt.col_status')}</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_apt.col_payment')}</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_apt.col_amount')}</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('admin_apt.col_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAppointments.map((apt) => {
                    const TypeIcon = TYPE_ICONS[apt.type] || Video
                    const next = STATUS_NEXT[apt.status] || []
                    return (
                      <tr key={apt.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={apt.patient?.fullName || 'П'} size="sm" />
                            <div>
                              <p className="font-medium text-slate-900 text-sm">
                                {apt.patient?.fullName || t('admin_apt.unknown_patient')}
                              </p>
                              <p className="text-xs text-slate-500">{apt.patient?.email || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar src={getMediaUrl(apt.doctor?.photo)} name={apt.doctor?.fullName || 'В'} size="sm" />
                            <div>
                              <p className="font-medium text-slate-900 text-sm">{apt.doctor?.fullName || '—'}</p>
                              <p className="text-xs text-slate-500">{apt.doctor?.specialization?.name || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-sm text-slate-700 whitespace-nowrap">
                          {formatDateTime(apt.dateTime)}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                            <TypeIcon className="w-4 h-4" />
                            {t(`admin_apt.type_${apt.type}`) || apt.type}
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          {next.length > 0 ? (
                            <StatusDropdown appointment={apt} onSelect={(newStatus) => openStatusModal(apt, newStatus)} />
                          ) : (
                            <StatusBadge status={apt.status} />
                          )}
                        </td>
                        <td className="py-3.5 px-5">
                          <PaymentDropdown appointment={apt} onChange={handlePaymentStatusChange} />
                        </td>
                        <td className="py-3.5 px-5 text-sm font-medium text-slate-900">
                          {apt.price ? formatPrice(apt.price) : '—'}
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="secondary" size="icon" title={t('admin_apt.details_btn')} onClick={() => setDetailAppointment(apt)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            {apt.roomId && (apt.status === 'confirmed' || apt.status === 'in_progress') && (
                              <Button variant="secondary" size="icon" title={t('admin_apt.open_room_icon')} onClick={() => window.open(`/consultation/${apt.roomId}`, '_blank')}>
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
                <span>{t('admin_apt.shown_count', { shown: filtered.length, total: appointments.length })}</span>
                <span>
                  {t('admin_apt.filter_sum')}{' '}
                  <strong className="text-slate-700">
                    {formatPrice(filtered.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.price || 0), 0))}
                  </strong>
                </span>
              </div>
            </div>
            <Pagination
              currentPage={safeCurrentPage}
              totalItems={filtered.length}
              pageSize={APPOINTMENTS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
            </>
          )}
        </CardContent>
      </Card>

      {detailAppointment && (
        <AppointmentDetailModal
          appointment={detailAppointment}
          onClose={() => setDetailAppointment(null)}
          onStatusChange={(newStatus) => openStatusModal(detailAppointment, newStatus)}
          onPaymentChange={(newStatus) => handlePaymentStatusChange(detailAppointment, newStatus)}
        />
      )}

      <Modal
        isOpen={statusModal.open}
        onClose={() => setStatusModal({ open: false, appointment: null, newStatus: null })}
        title={t('admin_apt.change_status_title')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusModal({ open: false, appointment: null, newStatus: null })} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={statusModal.newStatus === 'cancelled' ? 'danger' : 'primary'}
              onClick={confirmStatusChange}
              isLoading={isSaving}
            >
              {nextStatusLabels[statusModal.newStatus] || t('admin_apt.action_confirm')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-slate-600">
            {t('admin_apt.change_status_desc', {
              patient: statusModal.appointment?.patient?.fullName || t('admin_apt.participants_patient'),
              doctor: statusModal.appointment?.doctor?.fullName || '',
            })}
          </p>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <StatusBadge status={statusModal.appointment?.status} />
            <span className="text-slate-400">→</span>
            <StatusBadge status={statusModal.newStatus} />
          </div>
          {statusModal.newStatus === 'cancelled' && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              {t('admin_apt.cancel_warning')}
            </p>
          )}
        </div>
      </Modal>

      <AdminCreateUserModal
        isOpen={isPatientModalOpen}
        role='patient'
        onClose={() => setIsPatientModalOpen(false)}
      />

    </div>
  )
}

export default AdminAppointments
