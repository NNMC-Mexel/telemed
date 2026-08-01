import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  ImagePlus,
  Loader2,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { getMediaUrl, newsAPI, normalizeResponse, uploadFile } from '../../services/api'
import { useDialog } from '../../components/ui/Dialog'

const KIND_OPTIONS = [
  { value: 'promo', label: 'Акция' },
  { value: 'news', label: 'Новость' },
  { value: 'event', label: 'Событие' },
  { value: 'announcement', label: 'Анонс' },
]

const KIND_LABELS = Object.fromEntries(KIND_OPTIONS.map((option) => [option.value, option.label]))

const defaultForm = {
  title: '',
  excerpt: '',
  kind: 'news',
  badgeLabel: '',
  linkUrl: '',
  linkLabel: '',
  publishAt: '',
  expiresAt: '',
  isPinned: false,
  isActive: true,
  priority: '0',
  cover: null,
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

// Mirrors the server-side window check in `publicList`, so the list here shows
// the same "live right now" state a visitor would see on the landing page.
const isLive = (post) => {
  if (post.isActive === false) return false
  const now = Date.now()
  if (post.publishAt && new Date(post.publishAt).getTime() > now) return false
  if (post.expiresAt && new Date(post.expiresAt).getTime() < now) return false
  return true
}

const formatWindow = (post) => {
  const from = post.publishAt ? new Date(post.publishAt).toLocaleDateString('ru-RU') : 'сразу'
  const to = post.expiresAt ? new Date(post.expiresAt).toLocaleDateString('ru-RU') : 'без срока'
  return `${from} - ${to}`
}

function AdminNews() {
  const dialog = useDialog()
  const fileInputRef = useRef(null)
  const [posts, setPosts] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const response = await newsAPI.getAll()
      setPosts(normalizeResponse(response)?.data || [])
    } catch (error) {
      console.error('Error loading news:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredPosts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return posts
    return posts.filter((post) =>
      `${post.title || ''} ${post.excerpt || ''}`.toLowerCase().includes(term)
    )
  }, [posts, search])

  const openCreateModal = () => {
    setEditingPost(null)
    // The landing sorts by publishAt descending, so a post left without a date
    // would sink below older ones. Defaulting to now matches what an editor
    // means by "add a news item", and stays visible for them to change.
    setForm({ ...defaultForm, publishAt: toDatetimeLocal(new Date()) })
    setIsModalOpen(true)
  }

  const openEditModal = (post) => {
    setEditingPost(post)
    setForm({
      title: post.title || '',
      excerpt: post.excerpt || '',
      kind: post.kind || 'news',
      badgeLabel: post.badgeLabel || '',
      linkUrl: post.linkUrl || '',
      linkLabel: post.linkLabel || '',
      publishAt: toDatetimeLocal(post.publishAt),
      expiresAt: toDatetimeLocal(post.expiresAt),
      isPinned: Boolean(post.isPinned),
      isActive: post.isActive !== false,
      priority: String(post.priority || 0),
      cover: post.cover || null,
    })
    setIsModalOpen(true)
  }

  const handleCoverSelect = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsUploading(true)
    try {
      const uploaded = await uploadFile(file)
      setForm((prev) => ({ ...prev, cover: uploaded }))
    } catch (error) {
      console.error('Error uploading cover:', error)
      dialog.alert(error?.message || 'Не удалось загрузить изображение')
    } finally {
      setIsUploading(false)
    }
  }

  const buildPayload = () => ({
    title: form.title.trim(),
    excerpt: form.excerpt.trim() || null,
    kind: form.kind,
    badgeLabel: form.badgeLabel.trim() || null,
    linkUrl: form.linkUrl.trim() || null,
    linkLabel: form.linkLabel.trim() || null,
    publishAt: toIsoOrNull(form.publishAt),
    expiresAt: toIsoOrNull(form.expiresAt),
    isPinned: Boolean(form.isPinned),
    isActive: Boolean(form.isActive),
    priority: Number(form.priority) || 0,
    cover: form.cover?.id || null,
  })

  const validate = () => {
    if (!form.title.trim()) return 'Введите заголовок'
    if (form.title.trim().length > 120) return 'Заголовок не должен быть длиннее 120 символов'
    if (form.excerpt.trim().length > 220) return 'Описание не должно быть длиннее 220 символов'
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
      if (editingPost?.documentId) {
        await newsAPI.update(editingPost.documentId, payload)
      } else {
        await newsAPI.create(payload)
      }
      setIsModalOpen(false)
      setEditingPost(null)
      setForm(defaultForm)
      await loadData()
    } catch (error) {
      console.error('Error saving news post:', error)
      dialog.alert(error?.response?.data?.error?.message || 'Не удалось сохранить новость')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (post) => {
    if (!post?.documentId) return
    if (!await dialog.confirm(`Удалить новость "${post.title}"?`)) return
    try {
      await newsAPI.delete(post.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting news post:', error)
      dialog.alert('Не удалось удалить новость')
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
      </div>
    )
  }

  const coverPreview = form.cover ? getMediaUrl(form.cover) : null

  return (
    <div className='space-y-6 animate-fadeIn'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Новости и анонсы</h1>
          <p className='text-slate-600'>Блок на главной странице: акции, события и объявления центра</p>
        </div>
        <Button leftIcon={<Plus className='w-4 h-4' />} onClick={openCreateModal}>
          Добавить новость
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Поиск по заголовку или описанию...'
        leftIcon={<Search className='w-4 h-4' />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список новостей ({filteredPosts.length})</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='divide-y divide-slate-100'>
            {filteredPosts.length === 0 ? (
              <div className='px-4 py-10 text-center text-slate-500'>Новости не найдены</div>
            ) : (
              filteredPosts.map((post) => (
                <div key={post.documentId || post.id} className='p-4 sm:p-6'>
                  <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
                    <div className='flex min-w-0 gap-4'>
                      {post.cover ? (
                        <img
                          src={getMediaUrl(post.cover.formats?.thumbnail || post.cover)}
                          alt=''
                          className='h-16 w-16 shrink-0 rounded-xl object-cover'
                        />
                      ) : (
                        <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400'>
                          <ImagePlus className='w-5 h-5' />
                        </div>
                      )}
                      <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <h3 className='font-semibold text-slate-900'>{post.title}</h3>
                          <Badge variant={isLive(post) ? 'success' : 'secondary'}>
                            {isLive(post) ? 'На сайте' : 'Скрыта'}
                          </Badge>
                          <span className='rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700'>
                            {post.badgeLabel || KIND_LABELS[post.kind] || 'Новость'}
                          </span>
                          {post.isPinned && (
                            <span className='inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700'>
                              <Pin className='w-3 h-3' />
                              Закреплена
                            </span>
                          )}
                        </div>
                        {post.excerpt && (
                          <p className='mt-1 text-sm text-slate-500'>{post.excerpt}</p>
                        )}
                        <div className='mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600'>
                          <span className='inline-flex items-center gap-1.5'>
                            <CalendarDays className='w-4 h-4 text-slate-400' />
                            {formatWindow(post)}
                          </span>
                          <span>Приоритет: {post.priority || 0}</span>
                        </div>
                      </div>
                    </div>
                    <div className='flex justify-end gap-2'>
                      <Button size='icon' variant='secondary' onClick={() => openEditModal(post)} aria-label='Редактировать'>
                        <Pencil className='w-4 h-4' />
                      </Button>
                      <Button size='icon' variant='secondary' onClick={() => handleDelete(post)} aria-label='Удалить'>
                        <Trash2 className='w-4 h-4 text-rose-600' />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPost ? 'Редактировать новость' : 'Добавить новость'}
        size='xl'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>Отмена</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{editingPost ? 'Сохранить' : 'Создать'}</Button>
          </>
        }
      >
        <div className='space-y-5'>
          <div className='space-y-2'>
            <p className='text-sm font-medium text-slate-700'>Обложка</p>
            {coverPreview ? (
              <div className='relative overflow-hidden rounded-xl border border-slate-200'>
                <img src={coverPreview} alt='' className='h-44 w-full object-cover' />
                <button
                  type='button'
                  onClick={() => setForm((prev) => ({ ...prev, cover: null }))}
                  aria-label='Убрать обложку'
                  className='absolute right-3 top-3 rounded-full bg-slate-900/70 p-2 text-white transition-colors hover:bg-slate-900'
                >
                  <X className='w-4 h-4' />
                </button>
              </div>
            ) : (
              <button
                type='button'
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className='flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 transition-colors hover:border-teal-300 hover:text-teal-700 disabled:opacity-60'
              >
                {isUploading ? (
                  <Loader2 className='w-6 h-6 animate-spin' />
                ) : (
                  <>
                    <ImagePlus className='w-6 h-6' />
                    <span className='text-sm font-medium'>Загрузить изображение</span>
                    <span className='text-xs text-slate-400'>JPEG, PNG или WebP, до 10 МБ</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={fileInputRef}
              type='file'
              accept='image/jpeg,image/png,image/webp'
              onChange={handleCoverSelect}
              className='hidden'
            />
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <Input label='Заголовок' required value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            <Select
              label='Тип'
              value={form.kind}
              onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
              options={KIND_OPTIONS}
            />
          </div>

          <Textarea
            label='Краткое описание'
            rows={3}
            maxLength={220}
            value={form.excerpt}
            onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
            hint={`${form.excerpt.length}/220`}
          />

          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label='Бейдж'
              placeholder={KIND_LABELS[form.kind]}
              value={form.badgeLabel}
              onChange={(e) => setForm((prev) => ({ ...prev, badgeLabel: e.target.value }))}
            />
            <Input label='Ссылка' placeholder='/doctors' value={form.linkUrl} onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))} />
            <Input label='Текст ссылки' placeholder='Подробнее' value={form.linkLabel} onChange={(e) => setForm((prev) => ({ ...prev, linkLabel: e.target.value }))} />
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            <Input label='Публикация' type='datetime-local' value={form.publishAt} onChange={(e) => setForm((prev) => ({ ...prev, publishAt: e.target.value }))} />
            <Input label='Снять с показа' type='datetime-local' value={form.expiresAt} onChange={(e) => setForm((prev) => ({ ...prev, expiresAt: e.target.value }))} />
            <Input label='Приоритет' type='number' value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} />
          </div>

          <div className='grid sm:grid-cols-2 gap-3'>
            <label className='flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm cursor-pointer'>
              <input type='checkbox' checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
              <span className='font-medium text-slate-800'>Показывать на сайте</span>
            </label>
            <label className='flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm cursor-pointer'>
              <input type='checkbox' checked={form.isPinned} onChange={(e) => setForm((prev) => ({ ...prev, isPinned: e.target.checked }))} />
              <span className='font-medium text-slate-800'>Закрепить первой</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AdminNews
