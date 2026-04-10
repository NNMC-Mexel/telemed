import { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { useToast } from '../../components/ui/Toast'
import api, { normalizeResponse, getMediaUrl } from '../../services/api'
import { formatDateTime, formatPrice, formatDate } from '../../utils/helpers'

// ─── Конфигурация статусов ────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending:     { label: 'Ожидает',     variant: 'warning',   icon: Clock,        next: ['confirmed', 'cancelled'] },
  confirmed:   { label: 'Подтверждён', variant: 'primary',   icon: CheckCircle,  next: ['in_progress', 'cancelled'] },
  in_progress: { label: 'Идёт',        variant: 'info',      icon: PlayCircle,   next: ['completed', 'cancelled'] },
  completed:   { label: 'Завершён',    variant: 'success',   icon: CheckCircle,  next: [] },
  cancelled:   { label: 'Отменён',     variant: 'danger',    icon: XCircle,      next: [] },
}

const PAYMENT_CONFIG = {
  pending:  { label: 'Не оплачено', variant: 'warning' },
  paid:     { label: 'Оплачено',    variant: 'success' },
  failed:   { label: 'Ошибка',      variant: 'danger'  },
  refunded: { label: 'Возврат',     variant: 'default' },
}

const TYPE_CONFIG = {
  video: { label: 'Видео',   icon: Video },
  chat:  { label: 'Чат',     icon: MessageCircle },
}

const STATUS_FILTERS = [
  { value: 'all',         label: 'Все' },
  { value: 'pending',     label: 'Ожидают' },
  { value: 'confirmed',   label: 'Подтверждены' },
  { value: 'in_progress', label: 'Идут' },
  { value: 'completed',   label: 'Завершены' },
  { value: 'cancelled',   label: 'Отменены' },
]

const PAYMENT_FILTERS = [
  { value: 'all',      label: 'Все платежи' },
  { value: 'pending',  label: 'Не оплачено' },
  { value: 'paid',     label: 'Оплачено' },
  { value: 'failed',   label: 'Ошибка' },
  { value: 'refunded', label: 'Возврат' },
]

const NEXT_STATUS_LABELS = {
  confirmed:   'Подтвердить',
  in_progress: 'Начать',
  completed:   'Завершить',
  cancelled:   'Отменить',
}

// ─── Вспомогательные компоненты ──────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, variant: 'default' }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function PaymentBadge({ status }) {
  const cfg = PAYMENT_CONFIG[status] || { label: status, variant: 'default' }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Главный компонент ────────────────────────────────────────────────────────

function AdminAppointments() {
  const toast = useToast()

  const [appointments, setAppointments] = useState([])
  const [isLoading, setIsLoading]       = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Фильтры
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [dateFrom, setDateFrom]         = useState('')
  const [dateTo, setDateTo]             = useState('')

  // Детальное модальное окно
  const [detailAppointment, setDetailAppointment] = useState(null)

  // Модалка изменения статуса
  const [statusModal, setStatusModal]   = useState({ open: false, appointment: null, newStatus: null })
  const [isSaving, setIsSaving]         = useState(false)

  // ── Загрузка данных ─────────────────────────────────────────────────────────

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
      toast.error('Ошибка загрузки записей')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])

  // ── Фильтрация ──────────────────────────────────────────────────────────────

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

  // ── Статистика ──────────────────────────────────────────────────────────────

  const stats = {
    total:     appointments.length,
    pending:   appointments.filter(a => a.status === 'pending').length,
    today:     appointments.filter(a => {
      const d = new Date(a.dateTime)
      const now = new Date()
      return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length,
    revenue: appointments
      .filter(a => a.paymentStatus === 'paid')
      .reduce((sum, a) => sum + (a.price || 0), 0),
  }

  // ── Изменение статуса ───────────────────────────────────────────────────────

  const openStatusModal = (apt, newStatus) => {
    setStatusModal({ open: true, appointment: apt, newStatus })
  }

  const confirmStatusChange = async () => {
    const { appointment, newStatus } = statusModal
    if (!appointment || !newStatus) return

    setIsSaving(true)
    try {
      await api.put(`/api/appointments/${appointment.id}`, {
        data: { statuse: newStatus },
      })
      setAppointments(prev =>
        prev.map(a => a.id === appointment.id ? { ...a, status: newStatus, statuse: newStatus } : a)
      )
      // Обновляем детальную модалку если открыта
      if (detailAppointment?.id === appointment.id) {
        setDetailAppointment(prev => ({ ...prev, status: newStatus }))
      }
      toast.success(`Статус изменён на «${STATUS_CONFIG[newStatus]?.label}»`)
      setStatusModal({ open: false, appointment: null, newStatus: null })
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Не удалось изменить статус')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Изменение статуса оплаты ────────────────────────────────────────────────

  const handlePaymentStatusChange = async (apt, newPaymentStatus) => {
    try {
      await api.put(`/api/appointments/${apt.id}`, {
        data: { paymentStatus: newPaymentStatus },
      })
      setAppointments(prev =>
        prev.map(a => a.id === apt.id ? { ...a, paymentStatus: newPaymentStatus } : a)
      )
      if (detailAppointment?.id === apt.id) {
        setDetailAppointment(prev => ({ ...prev, paymentStatus: newPaymentStatus }))
      }
      toast.success('Статус оплаты обновлён')
    } catch (err) {
      console.error('Error updating payment status:', err)
      toast.error('Не удалось обновить оплату')
    }
  }

  // ── Экспорт CSV ─────────────────────────────────────────────────────────────

  const exportCSV = () => {
    const rows = [
      ['ID', 'Пациент', 'Email', 'Врач', 'Дата', 'Статус', 'Оплата', 'Сумма', 'Тип'],
      ...filtered.map(a => [
        a.id,
        a.patient?.fullName || '',
        a.patient?.email   || '',
        a.doctor?.fullName  || '',
        formatDateTime(a.dateTime),
        STATUS_CONFIG[a.status]?.label  || a.status,
        PAYMENT_CONFIG[a.paymentStatus]?.label || a.paymentStatus,
        a.price || 0,
        TYPE_CONFIG[a.type]?.label || a.type,
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `appointments_${formatDate(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Loader ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fadeIn">

      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Записи на приём</h1>
          <p className="text-slate-600">Управление всеми записями пациентов</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAppointments(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar}    label="Всего записей"  value={stats.total}            color="bg-gradient-to-br from-teal-500 to-sky-500" />
        <StatCard icon={Clock}       label="Сегодня"        value={stats.today}            color="bg-gradient-to-br from-amber-500 to-orange-500" />
        <StatCard icon={AlertCircle} label="Ожидают"        value={stats.pending}          color="bg-gradient-to-br from-violet-500 to-purple-500" />
        <StatCard icon={CreditCard}  label="Оплачено"       value={formatPrice(stats.revenue)} color="bg-gradient-to-br from-emerald-500 to-teal-500" />
      </div>

      {/* Фильтры */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">

            {/* Строка поиска */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по пациенту, врачу, room ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            {/* Фильтры статуса записи */}
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    statusFilter === value
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

            {/* Доп. фильтры: оплата + даты */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={paymentFilter}
                  onChange={e => setPaymentFilter(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  {PAYMENT_FILTERS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>С</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
                <span>по</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(''); setDateTo('') }}
                    className="text-rose-500 hover:text-rose-700 text-xs font-medium"
                  >
                    Сбросить
                  </button>
                )}
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Таблица */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">Записи не найдены</p>
              <p className="text-sm mt-1">Попробуйте изменить фильтры</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Пациент</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Врач</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Дата и время</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Тип</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Статус</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Оплата</th>
                    <th className="text-left py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Сумма</th>
                    <th className="text-right py-3.5 px-5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((apt) => {
                    const TypeIcon = TYPE_CONFIG[apt.type]?.icon || Video
                    const statusCfg = STATUS_CONFIG[apt.status] || {}
                    const nextStatuses = statusCfg.next || []

                    return (
                      <tr key={apt.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">

                        {/* Пациент */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar name={apt.patient?.fullName || 'П'} size="sm" />
                            <div>
                              <p className="font-medium text-slate-900 text-sm">
                                {apt.patient?.fullName || 'Неизвестный'}
                              </p>
                              <p className="text-xs text-slate-500">{apt.patient?.email || '—'}</p>
                            </div>
                          </div>
                        </td>

                        {/* Врач */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={getMediaUrl(apt.doctor?.photo)}
                              name={apt.doctor?.fullName || 'В'}
                              size="sm"
                            />
                            <div>
                              <p className="font-medium text-slate-900 text-sm">
                                {apt.doctor?.fullName || '—'}
                              </p>
                              <p className="text-xs text-slate-500">
                                {apt.doctor?.specialization?.name || '—'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Дата */}
                        <td className="py-3.5 px-5 text-sm text-slate-700 whitespace-nowrap">
                          {formatDateTime(apt.dateTime)}
                        </td>

                        {/* Тип */}
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                            <TypeIcon className="w-4 h-4" />
                            {TYPE_CONFIG[apt.type]?.label || apt.type}
                          </span>
                        </td>

                        {/* Статус записи */}
                        <td className="py-3.5 px-5">
                          {nextStatuses.length > 0 ? (
                            <StatusDropdown
                              appointment={apt}
                              onSelect={(newStatus) => openStatusModal(apt, newStatus)}
                            />
                          ) : (
                            <StatusBadge status={apt.status} />
                          )}
                        </td>

                        {/* Статус оплаты */}
                        <td className="py-3.5 px-5">
                          <PaymentDropdown
                            appointment={apt}
                            onChange={handlePaymentStatusChange}
                          />
                        </td>

                        {/* Сумма */}
                        <td className="py-3.5 px-5 text-sm font-medium text-slate-900">
                          {apt.price ? formatPrice(apt.price) : '—'}
                        </td>

                        {/* Действия */}
                        <td className="py-3.5 px-5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="secondary"
                              size="icon"
                              title="Подробнее"
                              onClick={() => setDetailAppointment(apt)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {apt.roomId && (apt.status === 'confirmed' || apt.status === 'in_progress') && (
                              <Button
                                variant="secondary"
                                size="icon"
                                title="Открыть комнату"
                                onClick={() => window.open(`/consultation/${apt.roomId}`, '_blank')}
                              >
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

              {/* Итого */}
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
                <span>Показано: <strong className="text-slate-700">{filtered.length}</strong> из {appointments.length}</span>
                <span>
                  Сумма по фильтру:{' '}
                  <strong className="text-slate-700">
                    {formatPrice(filtered.filter(a => a.paymentStatus === 'paid').reduce((s, a) => s + (a.price || 0), 0))}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Детальная модалка */}
      {detailAppointment && (
        <AppointmentDetailModal
          appointment={detailAppointment}
          onClose={() => setDetailAppointment(null)}
          onStatusChange={(newStatus) => openStatusModal(detailAppointment, newStatus)}
          onPaymentChange={(newStatus) => handlePaymentStatusChange(detailAppointment, newStatus)}
        />
      )}

      {/* Модалка подтверждения смены статуса */}
      <Modal
        isOpen={statusModal.open}
        onClose={() => setStatusModal({ open: false, appointment: null, newStatus: null })}
        title="Изменить статус записи"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setStatusModal({ open: false, appointment: null, newStatus: null })}
              disabled={isSaving}
            >
              Отмена
            </Button>
            <Button
              variant={statusModal.newStatus === 'cancelled' ? 'danger' : 'primary'}
              onClick={confirmStatusChange}
              isLoading={isSaving}
            >
              {NEXT_STATUS_LABELS[statusModal.newStatus] || 'Подтвердить'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-slate-600">
            Изменить статус записи{' '}
            <span className="font-semibold">
              {statusModal.appointment?.patient?.fullName || 'пациента'}
            </span>{' '}
            к врачу{' '}
            <span className="font-semibold">
              {statusModal.appointment?.doctor?.fullName || ''}
            </span>?
          </p>
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <StatusBadge status={statusModal.appointment?.status} />
            <span className="text-slate-400">→</span>
            <StatusBadge status={statusModal.newStatus} />
          </div>
          {statusModal.newStatus === 'cancelled' && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
              Отменённую запись нельзя восстановить.
            </p>
          )}
        </div>
      </Modal>

    </div>
  )
}

// ─── Дропдаун статуса прямо в таблице ────────────────────────────────────────

function StatusDropdown({ appointment, onSelect }) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[appointment.status] || {}
  const next = cfg.next || []

  if (next.length === 0) return <StatusBadge status={appointment.status} />

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 focus:outline-none"
      >
        <StatusBadge status={appointment.status} />
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-lg py-1 min-w-[160px]">
            {next.map(status => {
              const scfg = STATUS_CONFIG[status] || {}
              return (
                <button
                  key={status}
                  onClick={() => { setOpen(false); onSelect(status) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                >
                  <Badge variant={scfg.variant}>{scfg.label}</Badge>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Дропдаун статуса оплаты ─────────────────────────────────────────────────

function PaymentDropdown({ appointment, onChange }) {
  const [open, setOpen] = useState(false)
  const current = appointment.paymentStatus || 'pending'
  const statuses = ['pending', 'paid', 'failed', 'refunded']

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center gap-1 focus:outline-none"
      >
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

// ─── Детальная модалка ────────────────────────────────────────────────────────

function AppointmentDetailModal({ appointment: apt, onClose, onStatusChange, onPaymentChange }) {
  const TypeIcon = TYPE_CONFIG[apt.type]?.icon || Video
  const statusCfg = STATUS_CONFIG[apt.status] || {}
  const next = statusCfg.next || []

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Детали записи"
      size="lg"
    >
      <div className="space-y-6">

        {/* Участники */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Пациент</p>
            <div className="flex items-center gap-3">
              <Avatar name={apt.patient?.fullName || 'П'} size="md" />
              <div>
                <p className="font-semibold text-slate-900">{apt.patient?.fullName || 'Неизвестный'}</p>
                <p className="text-sm text-slate-500">{apt.patient?.email || '—'}</p>
                <p className="text-sm text-slate-500">{apt.patient?.phone || '—'}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Врач</p>
            <div className="flex items-center gap-3">
              <Avatar name={apt.doctor?.fullName || 'В'} size="md" />
              <div>
                <p className="font-semibold text-slate-900">{apt.doctor?.fullName || '—'}</p>
                <p className="text-sm text-slate-500">{apt.doctor?.specialization?.name || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Детали записи */}
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { label: 'Дата и время',  value: formatDateTime(apt.dateTime) },
            { label: 'Тип',           value: <span className="inline-flex items-center gap-1.5"><TypeIcon className="w-4 h-4" />{TYPE_CONFIG[apt.type]?.label || apt.type}</span> },
            { label: 'Room ID',       value: <code className="text-xs bg-slate-100 px-2 py-0.5 rounded">{apt.roomId || '—'}</code> },
            { label: 'Сумма',         value: apt.price ? formatPrice(apt.price) : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm font-medium text-slate-900">{value}</span>
            </div>
          ))}
        </div>

        {/* Статусы */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Статус записи</p>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={apt.status} />
              {next.map(s => (
                <button
                  key={s}
                  onClick={() => onStatusChange(s)}
                  className="text-xs px-2.5 py-1 rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-teal-500 hover:text-teal-600 transition-colors"
                >
                  → {STATUS_CONFIG[s]?.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Статус оплаты</p>
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
                    → {PAYMENT_CONFIG[s]?.label}
                  </button>
                ))
              }
            </div>
          </div>
        </div>

        {/* Жалобы / заметки */}
        {(apt.symptoms || apt.notes) && (
          <div className="space-y-3">
            {apt.symptoms && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Жалобы</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{apt.symptoms}</p>
              </div>
            )}
            {apt.notes && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Заметки врача</p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{apt.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Кнопка открыть комнату */}
        {apt.roomId && (apt.status === 'confirmed' || apt.status === 'in_progress') && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(`/consultation/${apt.roomId}`, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Открыть комнату консультации
          </Button>
        )}

      </div>
    </Modal>
  )
}

export default AdminAppointments
