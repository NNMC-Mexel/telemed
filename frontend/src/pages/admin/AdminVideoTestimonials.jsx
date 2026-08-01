import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ImagePlus,
  Loader2,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'
import { useDialog } from '../../components/ui/Dialog'
import {
  getMediaUrl,
  normalizeResponse,
  uploadFile,
  videoTestimonialsAPI,
} from '../../services/api'

const VIDEO_TYPES = ['video/mp4', 'video/webm']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_VIDEO_SIZE = 60 * 1024 * 1024
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

const defaultForm = {
  patientName: '',
  patientInitials: '',
  title: '',
  quote: '',
  specialty: '',
  durationSeconds: '',
  publishAt: '',
  expiresAt: '',
  isActive: false,
  priority: '0',
  consentConfirmed: false,
  consentRecordedAt: null,
  poster: null,
  video: null,
}

const toDatetimeLocal = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16)
}

const toIsoOrNull = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const isInsideWindow = (item) => {
  const now = Date.now()
  if (item.publishAt && new Date(item.publishAt).getTime() > now) return false
  if (item.expiresAt && new Date(item.expiresAt).getTime() < now) return false
  return true
}

const getPublicationStatus = (item) => {
  if (!item.consentConfirmed) return { label: 'Нет согласия', variant: 'warning' }
  if (item.isActive === false || !isInsideWindow(item)) return { label: 'Скрыт', variant: 'secondary' }
  return { label: 'На сайте', variant: 'success' }
}

const formatWindow = (item) => {
  const from = item.publishAt ? new Date(item.publishAt).toLocaleDateString('ru-RU') : 'сразу'
  const to = item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('ru-RU') : 'без срока'
  return `${from} — ${to}`
}

const formatDuration = (seconds) => {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return 'не указана'
  const minutes = Math.floor(value / 60)
  const rest = Math.floor(value % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export default function AdminVideoTestimonials() {
  const dialog = useDialog()
  const posterInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await videoTestimonialsAPI.getAll()
      setItems(normalizeResponse(response)?.data || [])
    } catch (error) {
      console.error('Error loading video testimonials:', error)
      dialog.alert('Не удалось загрузить видеоотзывы')
    } finally {
      setIsLoading(false)
    }
  }, [dialog])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter((item) =>
      [item.patientName, item.title, item.specialty]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)))
  }, [items, search])

  const openCreateModal = () => {
    setEditingItem(null)
    setForm({ ...defaultForm, publishAt: toDatetimeLocal(new Date()) })
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setForm({
      patientName: item.patientName || '',
      patientInitials: item.patientInitials || '',
      title: item.title || '',
      quote: item.quote || '',
      specialty: item.specialty || '',
      durationSeconds: item.durationSeconds ? String(item.durationSeconds) : '',
      publishAt: toDatetimeLocal(item.publishAt),
      expiresAt: toDatetimeLocal(item.expiresAt),
      isActive: item.isActive === true,
      priority: String(item.priority || 0),
      consentConfirmed: item.consentConfirmed === true,
      consentRecordedAt: item.consentRecordedAt || null,
      poster: item.poster || null,
      video: item.video || null,
    })
    setIsModalOpen(true)
  }

  const handleFile = async (event, field) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(field)
    try {
      const uploaded = await uploadFile(file, {
        allowedTypes: field === 'video' ? VIDEO_TYPES : IMAGE_TYPES,
        maxSizeBytes: field === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE,
      })
      setForm((previous) => ({ ...previous, [field]: uploaded }))
    } catch (error) {
      console.error('Error uploading testimonial media:', error)
      dialog.alert(error?.message || 'Не удалось загрузить файл')
    } finally {
      setUploading(null)
    }
  }

  const validate = () => {
    if (!form.patientName.trim()) return 'Введите имя пациента для публикации'
    if (!form.title.trim()) return 'Введите заголовок видеоотзыва'
    if (!form.video) return 'Загрузите видеоотзыв'
    if (form.isActive && !form.consentConfirmed) {
      return 'Для показа на сайте необходимо подтвердить согласие пациента'
    }
    const duration = Number(form.durationSeconds)
    if (form.durationSeconds && (!Number.isFinite(duration) || duration < 1 || duration > 3600)) {
      return 'Длительность должна быть от 1 до 3600 секунд'
    }
    if (form.publishAt && form.expiresAt && new Date(form.publishAt) >= new Date(form.expiresAt)) {
      return 'Дата снятия должна быть позже даты публикации'
    }
    return null
  }

  const buildPayload = () => ({
    patientName: form.patientName.trim(),
    patientInitials: form.patientInitials.trim() || null,
    title: form.title.trim(),
    quote: form.quote.trim() || null,
    specialty: form.specialty.trim() || null,
    durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : null,
    publishAt: toIsoOrNull(form.publishAt),
    expiresAt: toIsoOrNull(form.expiresAt),
    isActive: Boolean(form.isActive),
    priority: Number(form.priority) || 0,
    consentConfirmed: Boolean(form.consentConfirmed),
    consentRecordedAt: form.consentConfirmed
      ? form.consentRecordedAt || new Date().toISOString()
      : null,
    poster: form.poster?.id || null,
    video: form.video?.id || null,
  })

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      dialog.alert(validationError)
      return
    }

    setIsSaving(true)
    try {
      const payload = buildPayload()
      if (editingItem?.documentId) {
        await videoTestimonialsAPI.update(editingItem.documentId, payload)
      } else {
        await videoTestimonialsAPI.create(payload)
      }
      setIsModalOpen(false)
      setEditingItem(null)
      setForm(defaultForm)
      await loadData()
    } catch (error) {
      console.error('Error saving video testimonial:', error)
      dialog.alert(error?.response?.data?.error?.message || 'Не удалось сохранить видеоотзыв')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!item?.documentId) return
    if (!await dialog.confirm(`Удалить видеоотзыв пациента «${item.patientName}»?`)) return
    try {
      await videoTestimonialsAPI.delete(item.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting video testimonial:', error)
      dialog.alert('Не удалось удалить видеоотзыв')
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-teal-600' />
      </div>
    )
  }

  const posterPreview = getMediaUrl(form.poster?.formats?.medium || form.poster)
  const videoPreview = getMediaUrl(form.video)

  return (
    <div className='animate-fadeIn space-y-6'>
      <div className='flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Видеоотзывы</h1>
          <p className='text-slate-600'>Реальные истории пациентов с контролем согласия и публикации</p>
        </div>
        <Button leftIcon={<Plus className='h-4 w-4' />} onClick={openCreateModal}>
          Добавить видеоотзыв
        </Button>
      </div>

      <div className='rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900'>
        <div className='flex items-start gap-3'>
          <ShieldCheck className='mt-0.5 h-5 w-5 shrink-0 text-sky-700' />
          <p>Видео появится на лендинге только после подтверждения согласия пациента и включения показа.</p>
        </div>
      </div>

      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder='Поиск по пациенту, заголовку или специализации...'
        leftIcon={<Search className='h-4 w-4' />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Видеоотзывы ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='divide-y divide-slate-100'>
            {filteredItems.length === 0 ? (
              <div className='px-4 py-12 text-center'>
                <Video className='mx-auto h-9 w-9 text-slate-300' />
                <p className='mt-3 font-medium text-slate-700'>Видеоотзывов пока нет</p>
                <p className='mt-1 text-sm text-slate-500'>Загрузите первое согласованное видео пациента.</p>
              </div>
            ) : filteredItems.map((item) => {
              const status = getPublicationStatus(item)
              const poster = getMediaUrl(item.poster?.formats?.thumbnail || item.poster)
              return (
                <div key={item.documentId || item.id} className='p-4 sm:p-6'>
                  <div className='flex flex-col justify-between gap-4 lg:flex-row lg:items-center'>
                    <div className='flex min-w-0 items-center gap-4'>
                      {poster ? (
                        <img src={poster} alt='' className='h-20 w-16 shrink-0 rounded-xl object-cover' />
                      ) : (
                        <div className='flex h-20 w-16 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white'>
                          <Play className='h-6 w-6 fill-current' />
                        </div>
                      )}
                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <h3 className='font-semibold text-slate-900'>{item.patientName}</h3>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className='mt-1 truncate text-sm font-medium text-slate-700'>{item.title}</p>
                        <div className='mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-500'>
                          {item.specialty && <span>{item.specialty}</span>}
                          <span>{formatDuration(item.durationSeconds)}</span>
                          <span className='inline-flex items-center gap-1.5'>
                            <CalendarDays className='h-4 w-4' />
                            {formatWindow(item)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className='flex justify-end gap-2'>
                      <Button size='icon' variant='secondary' onClick={() => openEditModal(item)} aria-label='Редактировать'>
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button size='icon' variant='secondary' onClick={() => handleDelete(item)} aria-label='Удалить'>
                        <Trash2 className='h-4 w-4 text-rose-600' />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Редактировать видеоотзыв' : 'Добавить видеоотзыв'}
        description='Сохраняйте только материалы с документально подтверждённым согласием пациента.'
        size='xl'
        footer={(
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>Отмена</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{editingItem ? 'Сохранить' : 'Создать'}</Button>
          </>
        )}>
        <div className='space-y-5'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <p className='text-sm font-medium text-slate-700'>Видео <span className='text-rose-500'>*</span></p>
              {videoPreview ? (
                <div className='relative overflow-hidden rounded-2xl bg-slate-950'>
                  <video src={videoPreview} controls preload='metadata' className='aspect-video w-full object-contain' />
                  <button
                    type='button'
                    onClick={() => setForm((previous) => ({ ...previous, video: null }))}
                    aria-label='Убрать видео'
                    className='absolute right-2 top-2 rounded-full bg-slate-950/70 p-2 text-white'>
                    <X className='h-4 w-4' />
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploading === 'video'}
                  className='flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-60'>
                  {uploading === 'video' ? <Loader2 className='h-6 w-6 animate-spin' /> : <Video className='h-6 w-6' />}
                  <span className='text-sm font-medium'>Загрузить MP4 или WebM</span>
                  <span className='text-xs text-slate-400'>До 60 МБ</span>
                </button>
              )}
              <input ref={videoInputRef} type='file' accept='video/mp4,video/webm' onChange={(event) => handleFile(event, 'video')} className='hidden' />
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium text-slate-700'>Обложка</p>
              {posterPreview ? (
                <div className='relative overflow-hidden rounded-2xl'>
                  <img src={posterPreview} alt='' className='aspect-video w-full object-cover' />
                  <button
                    type='button'
                    onClick={() => setForm((previous) => ({ ...previous, poster: null }))}
                    aria-label='Убрать обложку'
                    className='absolute right-2 top-2 rounded-full bg-slate-950/70 p-2 text-white'>
                    <X className='h-4 w-4' />
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => posterInputRef.current?.click()}
                  disabled={uploading === 'poster'}
                  className='flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-60'>
                  {uploading === 'poster' ? <Loader2 className='h-6 w-6 animate-spin' /> : <ImagePlus className='h-6 w-6' />}
                  <span className='text-sm font-medium'>Загрузить JPG, PNG или WebP</span>
                  <span className='text-xs text-slate-400'>Рекомендуется вертикальное фото 4:5</span>
                </button>
              )}
              <input ref={posterInputRef} type='file' accept='image/jpeg,image/png,image/webp' onChange={(event) => handleFile(event, 'poster')} className='hidden' />
            </div>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <Input label='Имя пациента для публикации' required value={form.patientName} onChange={(event) => setForm((previous) => ({ ...previous, patientName: event.target.value }))} placeholder='Айгерим К.' />
            <Input label='Инициалы' value={form.patientInitials} onChange={(event) => setForm((previous) => ({ ...previous, patientInitials: event.target.value.slice(0, 4) }))} placeholder='АК' hint='Если не указать, сформируются автоматически' />
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            <Input label='Заголовок' required value={form.title} onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))} placeholder='Консультация без поездки в клинику' />
            <Input label='Направление' value={form.specialty} onChange={(event) => setForm((previous) => ({ ...previous, specialty: event.target.value }))} placeholder='Онлайн-консультация кардиолога' />
          </div>

          <Textarea label='Короткая цитата' maxLength={280} value={form.quote} onChange={(event) => setForm((previous) => ({ ...previous, quote: event.target.value }))} placeholder='Главная мысль пациента — до 280 символов' />

          <div className='grid gap-4 md:grid-cols-4'>
            <Input label='Публикация' type='datetime-local' value={form.publishAt} onChange={(event) => setForm((previous) => ({ ...previous, publishAt: event.target.value }))} />
            <Input label='Снять с показа' type='datetime-local' value={form.expiresAt} onChange={(event) => setForm((previous) => ({ ...previous, expiresAt: event.target.value }))} />
            <Input label='Длительность, сек' type='number' min='1' max='3600' value={form.durationSeconds} onChange={(event) => setForm((previous) => ({ ...previous, durationSeconds: event.target.value }))} />
            <Input label='Приоритет' type='number' value={form.priority} onChange={(event) => setForm((previous) => ({ ...previous, priority: event.target.value }))} />
          </div>

          <label className='flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm'>
            <input type='checkbox' checked={form.consentConfirmed} onChange={(event) => setForm((previous) => ({ ...previous, consentConfirmed: event.target.checked }))} className='mt-0.5' />
            <span>
              <span className='block font-medium text-slate-900'>Согласие пациента подтверждено</span>
              <span className='mt-0.5 block text-slate-500'>Пациент разрешил публичное размещение изображения, голоса и текста отзыва.</span>
            </span>
          </label>

          <label className='flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm'>
            <input type='checkbox' checked={form.isActive} onChange={(event) => setForm((previous) => ({ ...previous, isActive: event.target.checked }))} />
            <span className='font-medium text-slate-800'>Показывать на сайте</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}
