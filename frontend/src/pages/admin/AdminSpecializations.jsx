import { useEffect, useMemo, useState } from 'react'
import { GripVertical, Loader2, Pencil, Plus, Search, Tags, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import Modal from '../../components/ui/Modal'
import { normalizeResponse, specializationsAPI } from '../../services/api'

const defaultForm = {
  name: '',
  description: '',
  icon: '',
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    description: form.description?.trim() || '',
    icon: form.icon?.trim() || '',
  }
}

const sortByOrder = (list) =>
  [...(list || [])].sort((a, b) => {
    const orderA = Number(a.sortOrder) || 0
    const orderB = Number(b.sortOrder) || 0
    if (orderA !== orderB) return orderA - orderB
    return (a.name || '').localeCompare(b.name || '', 'ru')
  })

const arrayMove = (arr, fromIndex, toIndex) => {
  const next = [...arr]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

function AdminSpecializations() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReordering, setIsReordering] = useState(false)
  const [search, setSearch] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [draggingId, setDraggingId] = useState(null)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const res = await specializationsAPI.getAll()
      const { data } = normalizeResponse(res)
      setItems(sortByOrder(data || []))
    } catch (error) {
      console.error('Error loading specializations:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredItems = useMemo(() => {
    if (!search) return items || []
    const query = search.toLowerCase()
    return (items || []).filter((item) =>
      item.name?.toLowerCase().includes(query) ||
      item.description?.toLowerCase().includes(query) ||
      item.icon?.toLowerCase().includes(query),
    )
  }, [items, search])

  const openCreateModal = () => {
    setEditingItem(null)
    setForm(defaultForm)
    setIsModalOpen(true)
  }

  const openEditModal = (item) => {
    setEditingItem(item)
    setForm({
      name: item.name || '',
      description: item.description || '',
      icon: item.icon || '',
    })
    setIsModalOpen(true)
  }

  const persistOrder = async (orderedItems) => {
    setIsReordering(true)
    try {
      const updates = orderedItems
        .map((item, index) => ({
          documentId: item.documentId,
          nextOrder: index + 1,
          currentOrder: Number(item.sortOrder) || 0,
        }))
        .filter((item) => item.documentId && item.currentOrder !== item.nextOrder)

      if (updates.length > 0) {
        await Promise.all(
          updates.map((item) =>
            specializationsAPI.update(item.documentId, { sortOrder: item.nextOrder }),
          ),
        )
      }

      setItems(
        orderedItems.map((item, index) => ({
          ...item,
          sortOrder: index + 1,
        })),
      )
    } catch (error) {
      console.error('Error updating specialization order:', error)
      alert('Не удалось сохранить порядок специализаций')
      await loadData()
    } finally {
      setIsReordering(false)
    }
  }

  const handleRowDrop = async (targetId) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      return
    }

    const fromIndex = items.findIndex((item) => item.documentId === draggingId)
    const toIndex = items.findIndex((item) => item.documentId === targetId)

    if (fromIndex < 0 || toIndex < 0) {
      setDraggingId(null)
      return
    }

    const reordered = arrayMove(items, fromIndex, toIndex)
    setItems(reordered)
    setDraggingId(null)
    await persistOrder(reordered)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!form.name.trim()) {
      alert('Название специализации обязательно')
      return
    }

    setIsSaving(true)
    try {
      const payload = toPayload(form)

      if (editingItem?.documentId) {
        await specializationsAPI.update(editingItem.documentId, {
          ...payload,
          sortOrder: Number(editingItem.sortOrder) || 0,
        })
      } else {
        await specializationsAPI.create({
          ...payload,
          sortOrder: (items?.length || 0) + 1,
        })
      }

      setIsModalOpen(false)
      setEditingItem(null)
      setForm(defaultForm)
      await loadData()
    } catch (error) {
      console.error('Error saving specialization:', error)
      alert('Не удалось сохранить специализацию')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!item?.documentId) return

    const confirmed = window.confirm(`Удалить специализацию "${item.name}"?`)
    if (!confirmed) return

    try {
      await specializationsAPI.delete(item.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting specialization:', error)
      alert('Не удалось удалить специализацию')
    }
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
          <h1 className='text-2xl font-bold text-slate-900'>Специализации</h1>
          <p className='text-slate-600'>Создание, редактирование и изменение порядка направлений врачей</p>
        </div>
        <Button leftIcon={<Plus className='w-4 h-4' />} onClick={openCreateModal}>
          Добавить специализацию
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder='Поиск по названию, описанию или иконке...'
        leftIcon={<Search className='w-4 h-4' />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Список специализаций ({filteredItems.length})</CardTitle>
          <p className='text-sm text-slate-500'>
            Перетащите строку за иконку слева, чтобы изменить порядок. Первый в списке получает порядок `1`.
          </p>
          {search.trim() && (
            <p className='text-xs text-amber-600'>
              Режим перетаскивания отключен во время поиска.
            </p>
          )}
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-slate-200'>
                  <th className='text-left py-4 px-4 font-medium text-slate-500 w-14'></th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>Название</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>Описание</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>Иконка</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>Порядок</th>
                  <th className='text-right py-4 px-6 font-medium text-slate-500'>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='text-center py-10 text-slate-500'>
                      Специализации не найдены
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.documentId || item.id}
                      className={`border-b border-slate-100 hover:bg-slate-50 ${draggingId === item.documentId ? 'opacity-60' : ''}`}
                      draggable={!search.trim() && !isReordering}
                      onDragStart={() => setDraggingId(item.documentId)}
                      onDragEnd={() => setDraggingId(null)}
                      onDragOver={(e) => {
                        if (search.trim() || isReordering) return
                        e.preventDefault()
                      }}
                      onDrop={(e) => {
                        if (search.trim() || isReordering) return
                        e.preventDefault()
                        handleRowDrop(item.documentId)
                      }}
                    >
                      <td className='py-4 px-4 text-slate-400'>
                        <div className='inline-flex items-center justify-center'>
                          <GripVertical className='w-4 h-4' />
                        </div>
                      </td>
                      <td className='py-4 px-6 font-medium text-slate-900'>{item.name}</td>
                      <td className='py-4 px-6 text-slate-600 max-w-md truncate'>
                        {item.description || '—'}
                      </td>
                      <td className='py-4 px-6 text-slate-600'>
                        <div className='inline-flex items-center gap-2'>
                          <Tags className='w-4 h-4 text-teal-600' />
                          <span>{item.icon || '—'}</span>
                        </div>
                      </td>
                      <td className='py-4 px-6 text-slate-600'>{items.findIndex((x) => x.documentId === item.documentId) + 1}</td>
                      <td className='py-4 px-6'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => openEditModal(item)}
                            aria-label='Редактировать'
                          >
                            <Pencil className='w-4 h-4' />
                          </Button>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => handleDelete(item)}
                            aria-label='Удалить'
                          >
                            <Trash2 className='w-4 h-4 text-rose-600' />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Редактировать специализацию' : 'Добавить специализацию'}
        size='lg'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Отмена
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {editingItem ? 'Сохранить' : 'Создать'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className='space-y-4'>
          <Input
            label='Название'
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder='Например: Кардиолог'
          />

          <Textarea
            label='Описание'
            rows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder='Краткое описание специализации'
          />

          <Input
            label='Порядок'
            value={editingItem ? String((editingItem.sortOrder || 0) || 1) : String((items?.length || 0) + 1)}
            disabled
            hint='Порядок меняется перетаскиванием в списке'
          />

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='Иконка (slug)'
              value={form.icon}
              onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
              placeholder='Например: heart'
              hint='Текстовый ключ иконки'
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default AdminSpecializations
