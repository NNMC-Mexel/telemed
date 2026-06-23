import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Loader2, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { doctorsAPI, normalizeResponse, promotionsAPI, specializationsAPI } from '../../services/api'
import { formatPrice } from '../../utils/helpers'

const defaultForm = {
  title: '',
  description: '',
  badgeLabel: 'Акция',
  scope: 'doctors',
  discountType: 'percentage',
  discountValue: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
  priority: '0',
  doctorIds: [],
  specializationIds: [],
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

const relationIds = (items) => (Array.isArray(items) ? items.map((item) => String(item.id)) : [])

function AdminPromotions() {
  const [promotions, setPromotions] = useState([])
  const [doctors, setDoctors] = useState([])
  const [specializations, setSpecializations] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPromotion, setEditingPromotion] = useState(null)
  const [form, setForm] = useState(defaultForm)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [promotionsRes, doctorsRes, specsRes] = await Promise.all([
        promotionsAPI.getAll(),
        doctorsAPI.getAll({ includeInactive: true }),
        specializationsAPI.getAll(),
      ])
      setPromotions(normalizeResponse(promotionsRes)?.data || [])
      setDoctors(normalizeResponse(doctorsRes)?.data || [])
      setSpecializations(normalizeResponse(specsRes)?.data || [])
    } catch (error) {
      console.error('Error loading promotions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredPromotions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return promotions
    return promotions.filter((promotion) =>
      `${promotion.title || ''} ${promotion.description || ''}`.toLowerCase().includes(term)
    )
  }, [promotions, search])

  const openCreateModal = () => {
    setEditingPromotion(null)
    setForm(defaultForm)
    setIsModalOpen(true)
  }

  const openEditModal = (promotion) => {
    setEditingPromotion(promotion)
    setForm({
      title: promotion.title || '',
      description: promotion.description || '',
      badgeLabel: promotion.badgeLabel || 'Акция',
      scope: promotion.scope || 'doctors',
      discountType: promotion.discountType || 'percentage',
      discountValue: String(promotion.discountValue || ''),
      startsAt: toDatetimeLocal(promotion.startsAt),
      endsAt: toDatetimeLocal(promotion.endsAt),
      isActive: promotion.isActive !== false,
      priority: String(promotion.priority || 0),
      doctorIds: relationIds(promotion.doctors),
      specializationIds: relationIds(promotion.specializations),
    })
    setIsModalOpen(true)
  }

  const toggleId = (field, id) => {
    const value = String(id)
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
    }))
  }

  const buildPayload = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    badgeLabel: form.badgeLabel.trim() || 'Акция',
    scope: form.scope,
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    startsAt: toIsoOrNull(form.startsAt),
    endsAt: toIsoOrNull(form.endsAt),
    isActive: Boolean(form.isActive),
    priority: Number(form.priority) || 0,
    doctors: form.scope === 'doctors' ? form.doctorIds.map(Number) : [],
    specializations: form.scope === 'specializations' ? form.specializationIds.map(Number) : [],
  })

  const validate = () => {
    if (!form.title.trim()) return 'Введите название акции'
    const discountValue = Number(form.discountValue)
    if (!Number.isFinite(discountValue) || discountValue <= 0) return 'Укажите корректную скидку'
    if (form.discountType === 'percentage' && discountValue > 99) return 'Процентная скидка должна быть меньше 100%'
    if (form.scope === 'doctors' && form.doctorIds.length === 0) return 'Выберите хотя бы одного врача'
    if (form.scope === 'specializations' && form.specializationIds.length === 0) return 'Выберите хотя бы одну специализацию'
    if (form.startsAt && form.endsAt && new Date(form.startsAt) >= new Date(form.endsAt)) return 'Дата окончания должна быть позже даты начала'
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      alert(validationError)
      return
    }

    setIsSaving(true)
    try {
      const payload = buildPayload()
      if (editingPromotion?.documentId) {
        await promotionsAPI.update(editingPromotion.documentId, payload)
      } else {
        await promotionsAPI.create(payload)
      }
      setIsModalOpen(false)
      setEditingPromotion(null)
      setForm(defaultForm)
      await loadData()
    } catch (error) {
      console.error('Error saving promotion:', error)
      alert(error?.response?.data?.error?.message || 'Не удалось сохранить акцию')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (promotion) => {
    if (!promotion?.documentId) return
    if (!window.confirm(`Удалить акцию "${promotion.title}"?`)) return
    try {
      await promotionsAPI.delete(promotion.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting promotion:', error)
      alert('Не удалось удалить акцию')
    }
  }

  const renderDiscount = (promotion) => {
    if (promotion.discountType === 'percentage') return `${promotion.discountValue}%`
    if (promotion.discountType === 'fixed_amount') return `-${formatPrice(promotion.discountValue)}`
    return formatPrice(promotion.discountValue)
  }

  const renderScope = (promotion) => {
    if (promotion.scope === 'all') return 'Все консультации'
    if (promotion.scope === 'specializations') return `${promotion.specializations?.length || 0} специализаций`
    return `${promotion.doctors?.length || 0} врачей`
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
      </div>
    )
  }

  return (
    <div className='space-y-6 animate-fadeIn'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Акции</h1>
          <p className='text-slate-600'>Скидки для врачей, специализаций или всех консультаций</p>
        </div>
        <Button leftIcon={<Plus className='w-4 h-4' />} onClick={openCreateModal}>
          Добавить акцию
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Поиск по названию или описанию...'
        leftIcon={<Search className='w-4 h-4' />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список акций ({filteredPromotions.length})</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='divide-y divide-slate-100'>
            {filteredPromotions.length === 0 ? (
              <div className='px-4 py-10 text-center text-slate-500'>Акции не найдены</div>
            ) : (
              filteredPromotions.map((promotion) => (
                <div key={promotion.documentId || promotion.id} className='p-4 sm:p-6'>
                  <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <h3 className='font-semibold text-slate-900'>{promotion.title}</h3>
                        <Badge variant={promotion.isActive === false ? 'secondary' : 'success'}>
                          {promotion.isActive === false ? 'Выключена' : 'Активна'}
                        </Badge>
                        <span className='rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700'>
                          {renderDiscount(promotion)}
                        </span>
                      </div>
                      {promotion.description && (
                        <p className='mt-1 text-sm text-slate-500'>{promotion.description}</p>
                      )}
                      <div className='mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600'>
                        <span className='inline-flex items-center gap-1.5'>
                          <Tags className='w-4 h-4 text-slate-400' />
                          {renderScope(promotion)}
                        </span>
                        <span className='inline-flex items-center gap-1.5'>
                          <CalendarDays className='w-4 h-4 text-slate-400' />
                          {promotion.startsAt ? new Date(promotion.startsAt).toLocaleDateString('ru-RU') : 'сейчас'}
                          {' - '}
                          {promotion.endsAt ? new Date(promotion.endsAt).toLocaleDateString('ru-RU') : 'без срока'}
                        </span>
                        <span>Приоритет: {promotion.priority || 0}</span>
                      </div>
                    </div>
                    <div className='flex justify-end gap-2'>
                      <Button size='icon' variant='secondary' onClick={() => openEditModal(promotion)} aria-label='Редактировать'>
                        <Pencil className='w-4 h-4' />
                      </Button>
                      <Button size='icon' variant='secondary' onClick={() => handleDelete(promotion)} aria-label='Удалить'>
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
        title={editingPromotion ? 'Редактировать акцию' : 'Добавить акцию'}
        size='xl'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>Отмена</Button>
            <Button onClick={handleSave} isLoading={isSaving}>{editingPromotion ? 'Сохранить' : 'Создать'}</Button>
          </>
        }
      >
        <div className='space-y-5'>
          <div className='grid md:grid-cols-2 gap-4'>
            <Input label='Название' required value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} />
            <Input label='Бейдж' value={form.badgeLabel} onChange={(e) => setForm((prev) => ({ ...prev, badgeLabel: e.target.value }))} />
          </div>

          <Input label='Описание' value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />

          <div className='grid md:grid-cols-3 gap-4'>
            <Select
              label='Тип скидки'
              value={form.discountType}
              onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value }))}
              options={[
                { value: 'percentage', label: 'Процент' },
                { value: 'fixed_amount', label: 'Сумма скидки' },
                { value: 'fixed_price', label: 'Новая цена' },
              ]}
            />
            <Input label='Значение' required type='number' min='1' value={form.discountValue} onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))} />
            <Input label='Приоритет' type='number' value={form.priority} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} />
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            <Select
              label='Где действует'
              value={form.scope}
              onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value }))}
              options={[
                { value: 'doctors', label: 'Выбранные врачи' },
                { value: 'specializations', label: 'Специализации' },
                { value: 'all', label: 'Все консультации' },
              ]}
            />
            <Input label='Начало' type='datetime-local' value={form.startsAt} onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))} />
            <Input label='Окончание' type='datetime-local' value={form.endsAt} onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))} />
          </div>

          {form.scope === 'doctors' && (
            <div className='space-y-2'>
              <p className='text-sm font-medium text-slate-700'>Врачи</p>
              <div className='max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100'>
                {doctors.map((doctor) => (
                  <label key={doctor.id} className='flex items-center gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-slate-50'>
                    <input type='checkbox' checked={form.doctorIds.includes(String(doctor.id))} onChange={() => toggleId('doctorIds', doctor.id)} />
                    <span className='font-medium text-slate-800'>{doctor.fullName}</span>
                    <span className='text-slate-400'>{formatPrice(doctor.price || 0)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.scope === 'specializations' && (
            <div className='space-y-2'>
              <p className='text-sm font-medium text-slate-700'>Специализации</p>
              <div className='grid sm:grid-cols-2 gap-2'>
                {specializations.map((spec) => (
                  <label key={spec.id} className='flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm cursor-pointer hover:bg-slate-50'>
                    <input type='checkbox' checked={form.specializationIds.includes(String(spec.id))} onChange={() => toggleId('specializationIds', spec.id)} />
                    <span className='font-medium text-slate-800'>{spec.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className='flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm cursor-pointer'>
            <input type='checkbox' checked={form.isActive} onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
            <span className='font-medium text-slate-800'>Акция включена</span>
          </label>
        </div>
      </Modal>
    </div>
  )
}

export default AdminPromotions
