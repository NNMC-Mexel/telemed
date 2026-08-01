import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Clapperboard, ImagePlus, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { UPLOAD_STORY_TYPES, getMediaUrl, normalizeResponse, storiesAPI, uploadFile } from '../../services/api'
import { useDialog } from '../../components/ui/Dialog'

const defaultForm = {
  title: '',
  linkUrl: '',
  linkLabel: '',
  durationSeconds: '8',
  publishAt: '',
  expiresAt: '',
  isActive: true,
  priority: '0',
  poster: null,
  media: null,
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

// Mirrors the server-side window check, so this list shows the same "live now"
// state a visitor would see.
const isLive = (story) => {
  if (story.isActive === false) return false
  const now = Date.now()
  if (story.publishAt && new Date(story.publishAt).getTime() > now) return false
  if (story.expiresAt && new Date(story.expiresAt).getTime() < now) return false
  return true
}

const formatWindow = (story) => {
  const from = story.publishAt ? new Date(story.publishAt).toLocaleDateString('ru-RU') : 'сразу'
  const to = story.expiresAt ? new Date(story.expiresAt).toLocaleDateString('ru-RU') : 'без срока'
  return `${from} - ${to}`
}

function AdminStories() {
  const dialog = useDialog()
  const posterInputRef = useRef(null)
  const mediaInputRef = useRef(null)
  const [stories, setStories] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStory, setEditingStory] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const response = await storiesAPI.getAll()
      setStories(normalizeResponse(response)?.data || [])
    } catch (error) {
      console.error('Error loading stories:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredStories = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return stories
    return stories.filter((story) => (story.title || '').toLowerCase().includes(term))
  }, [stories, search])

  const openCreateModal = () => {
    setEditingStory(null)
    setForm({ ...defaultForm, publishAt: toDatetimeLocal(new Date()) })
    setIsModalOpen(true)
  }

  const openEditModal = (story) => {
    setEditingStory(story)
    setForm({
      title: story.title || '',
      linkUrl: story.linkUrl || '',
      linkLabel: story.linkLabel || '',
      durationSeconds: String(story.durationSeconds || 8),
      publishAt: toDatetimeLocal(story.publishAt),
      expiresAt: toDatetimeLocal(story.expiresAt),
      isActive: story.isActive !== false,
      priority: String(story.priority || 0),
      poster: story.poster || null,
      media: story.media || null,
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
        allowedTypes: UPLOAD_STORY_TYPES,
        maxSizeBytes: 60 * 1024 * 1024,
      })
      setForm((prev) => ({ ...prev, [field]: uploaded }))
    } catch (error) {
      console.error('Error uploading story media:', error)
      dialog.alert(error?.message || 'Не удалось загрузить файл')
    } finally {
      setUploading(null)
    }
  }

  const buildPayload = () => ({
    title: form.title.trim(),
    linkUrl: form.linkUrl.trim() || null,
    linkLabel: form.linkLabel.trim() || null,
    durationSeconds: Number(form.durationSeconds) || 8,
    publishAt: toIsoOrNull(form.publishAt),
    expiresAt: toIsoOrNull(form.expiresAt),
    isActive: Boolean(form.isActive),
    priority: Number(form.priority) || 0,
    poster: form.poster?.id || null,
    media: form.media?.id || null,
  })

  const validate = () => {
    if (!form.title.trim()) return 'Введите заголовок'
    if (!form.media) return 'Загрузите видео или изображение сюжета'
    const duration = Number(form.durationSeconds)
    if (!Number.isFinite(duration) || duration < 3 || duration > 60) {
      return 'Длительность должна быть от 3 до 60 секунд'
    }
    if (form.linkLabel.trim() && !form.linkUrl.trim()) return 'Укажите ссылку для кнопки'
    if (form.publishAt && form.expiresAt && new Date(form.publishAt) >= new Date(form.expiresAt)) {
      return 'Дата снятия должна быть позже даты публикации'
    }
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      dialog.alert(validationError)
      return
    }

    setIsSaving(true)
    try {
      const payload = buildPayload()
      if (editingStory?.documentId) {
        await storiesAPI.update(editingStory.documentId, payload)
      } else {
        await storiesAPI.create(payload)
      }
      setIsModalOpen(false)
      setEditingStory(null)
      setForm(defaultForm)
      await loadData()
    } catch (error) {
      console.error('Error saving story:', error)
      dialog.alert(error?.response?.data?.error?.message || 'Не удалось сохранить сюжет')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (story) => {
    if (!story?.documentId) return
    if (!await dialog.confirm(`Удалить сюжет "${story.title}"?`)) return
    try {
      await storiesAPI.delete(story.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting story:', error)
      dialog.alert('Не удалось удалить сюжет')
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
      </div>
    )
  }

  const posterPreview = form.poster ? getMediaUrl(form.poster) : null
  const mediaIsVideo = Boolean(form.media?.mime?.startsWith('video/'))

  return (
    <div className='space-y-6 animate-fadeIn'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Сторис</h1>
          <p className='text-slate-600'>Короткие вертикальные сюжеты в кружках над блоком новостей</p>
        </div>
        <Button leftIcon={<Plus className='w-4 h-4' />} onClick={openCreateModal}>
          Добавить сюжет
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Поиск по заголовку...'
        leftIcon={<Search className='w-4 h-4' />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список сюжетов ({filteredStories.length})</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='divide-y divide-slate-100'>
            {filteredStories.length === 0 ? (
              <div className='px-4 py-10 text-center text-slate-500'>Сюжеты не найдены</div>
            ) : (
              filteredStories.map((story) => {
                const circle = story.poster ? getMediaUrl(story.poster.formats?.thumbnail || story.poster) : null
                const isVideo = story.media?.mime?.startsWith('video/')
                return (
                  <div key={story.documentId || story.id} className='p-4 sm:p-6'>
                    <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
                      <div className='flex min-w-0 gap-4 items-center'>
                        {circle ? (
                          <img src={circle} alt='' className='h-14 w-14 shrink-0 rounded-full object-cover' />
                        ) : (
                          <div className='flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400'>
                            <Clapperboard className='w-5 h-5' />
                          </div>
                        )}
                        <div className='min-w-0'>
                          <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='font-semibold text-slate-900'>{story.title}</h3>
                            <Badge variant={isLive(story) ? 'success' : 'secondary'}>
                              {isLive(story) ? 'На сайте' : 'Скрыт'}
                            </Badge>
                            <span className='rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700'>
                              {isVideo ? 'Видео' : 'Фото'}
                            </span>
                          </div>
                          <div className='mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600'>
                            <span className='inline-flex items-center gap-1.5'>
                              <CalendarDays className='w-4 h-4 text-slate-400' />
                              {formatWindow(story)}
                            </span>
                            {!isVideo && <span>{story.durationSeconds || 8} сек</span>}
                            <span>Приоритет: {story.priority || 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className='flex justify-end gap-2'>
                        <Button size='icon' variant='secondary' onClick={() => openEditModal(story)} aria-label='Редактировать'>
                          <Pencil className='w-4 h-4' />
                        </Button>
                        <Button size='icon' variant='secondary' onClick={() => handleDelete(story)} aria-label='Удалить'>
                          <Trash2 className='w-4 h-4 text-rose-600' />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingStory ? 'Редактировать сюжет' : 'Добавить сюжет'}
        size='xl'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>Отмена</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{editingStory ? 'Сохранить' : 'Создать'}</Button>
          </>
        }
      >
        <div className='space-y-5'>
          <div className='grid sm:grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <p className='text-sm font-medium text-slate-700'>Кружок (превью)</p>
              {posterPreview ? (
                <div className='relative w-fit'>
                  <img src={posterPreview} alt='' className='h-28 w-28 rounded-full object-cover' />
                  <button
                    type='button'
                    onClick={() => setForm((prev) => ({ ...prev, poster: null }))}
                    aria-label='Убрать превью'
                    className='absolute -right-1 -top-1 rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-slate-900'
                  >
                    <X className='w-3.5 h-3.5' />
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => posterInputRef.current?.click()}
                  disabled={uploading === 'poster'}
                  className='flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-full border-2 border-dashed border-slate-200 text-slate-500 transition-colors hover:border-teal-300 hover:text-teal-700 disabled:opacity-60'
                >
                  {uploading === 'poster' ? <Loader2 className='w-5 h-5 animate-spin' /> : <ImagePlus className='w-5 h-5' />}
                  <span className='text-xs font-medium'>Превью</span>
                </button>
              )}
              <p className='text-xs text-slate-400'>Если не загрузить — для фото возьмётся сам сюжет</p>
              <input ref={posterInputRef} type='file' accept='image/jpeg,image/png,image/webp' onChange={(e) => handleFile(e, 'poster')} className='hidden' />
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium text-slate-700'>Сюжет (видео или фото) <span className='text-rose-500'>*</span></p>
              {form.media ? (
                <div className='flex items-center gap-3 rounded-xl border border-slate-200 p-3'>
                  <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700'>
                    <Clapperboard className='w-5 h-5' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium text-slate-800'>{form.media.name}</p>
                    <p className='text-xs text-slate-500'>{mediaIsVideo ? 'Видео' : 'Изображение'}</p>
                  </div>
                  <button
                    type='button'
                    onClick={() => setForm((prev) => ({ ...prev, media: null }))}
                    aria-label='Убрать файл'
                    className='rounded-full p-1.5 text-slate-500 hover:bg-slate-100'
                  >
                    <X className='w-4 h-4' />
                  </button>
                </div>
              ) : (
                <button
                  type='button'
                  onClick={() => mediaInputRef.current?.click()}
                  disabled={uploading === 'media'}
                  className='flex h-28 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 transition-colors hover:border-teal-300 hover:text-teal-700 disabled:opacity-60'
                >
                  {uploading === 'media' ? <Loader2 className='w-5 h-5 animate-spin' /> : <Clapperboard className='w-5 h-5' />}
                  <span className='text-sm font-medium'>Загрузить сюжет</span>
                  <span className='text-xs text-slate-400'>Вертикальное видео 9:16 или фото</span>
                </button>
              )}
              <input ref={mediaInputRef} type='file' accept='video/mp4,video/webm,image/jpeg,image/png,image/webp' onChange={(e) => handleFile(e, 'media')} className='hidden' />
            </div>
          </div>

          <Input label='Заголовок' required value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />

          <div className='grid md:grid-cols-3 gap-4'>
            <Input label='Ссылка' placeholder='/doctors' value={form.linkUrl} onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))} />
            <Input label='Текст кнопки' placeholder='Записаться' value={form.linkLabel} onChange={(e) => setForm((prev) => ({ ...prev, linkLabel: e.target.value }))} />
            <Input
              label='Длительность, сек'
              type='number'
              min='3'
              max='60'
              value={form.durationSeconds}
              onChange={(e) => setForm((prev) => ({ ...prev, durationSeconds: e.target.value }))}
              hint='Для фото; у видео своя длительность'
            />
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            <Input label='Публикация' type='datetime-local' value={form.publishAt} onChange={(e) => setForm((prev) => ({ ...prev, publishAt: e.target.value }))} />
            <Input label='Снять с показа' type='datetime-local' value={form.expiresAt} onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))} />
            <Input label='Приоритет' type='number' value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} />
          </div>

          <label className='flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm cursor-pointer'>
            <input type='checkbox' checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
            <span className='font-medium text-slate-800'>Показывать на сайте</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}

export default AdminStories
