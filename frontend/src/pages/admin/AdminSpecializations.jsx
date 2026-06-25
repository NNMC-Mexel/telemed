import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      alert(t('admin_spec.err_save_order'))
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
      alert(t('admin_spec.err_name'))
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
      alert(t('admin_spec.err_save'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (item) => {
    if (!item?.documentId) return

    const confirmed = window.confirm(t('admin_spec.confirm_delete', { name: item.name }))
    if (!confirmed) return

    try {
      await specializationsAPI.delete(item.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting specialization:', error)
      alert(t('admin_spec.err_delete'))
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
          <h1 className='text-2xl font-bold text-slate-900'>{t('admin_spec.title')}</h1>
          <p className='text-slate-600'>{t('admin_spec.subtitle')}</p>
        </div>
        <Button className='w-full sm:w-auto' leftIcon={<Plus className='w-4 h-4' />} onClick={openCreateModal}>
          {t('admin_spec.add_btn')}
        </Button>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('admin_spec.search_placeholder')}
        leftIcon={<Search className='w-4 h-4' />}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('admin_spec.list_title', { count: filteredItems.length })}</CardTitle>
          <p className='hidden text-sm text-slate-500 md:block'>{t('admin_spec.drag_hint')}</p>
          {search.trim() && (
            <p className='hidden text-xs text-amber-600 md:block'>{t('admin_spec.drag_disabled')}</p>
          )}
        </CardHeader>
        <CardContent className='p-0'>
          <div className='divide-y divide-slate-100 md:hidden'>
            {filteredItems.length === 0 ? (
              <div className='px-4 py-10 text-center text-slate-500'>
                {t('admin_spec.not_found')}
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.documentId || item.id} className='p-4'>
                  <div className='flex items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className='font-semibold text-slate-900 break-words'>{item.name}</p>
                      <p className='mt-1 text-sm text-slate-500 break-words'>
                        {item.description || '—'}
                      </p>
                    </div>
                    <div className='shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600'>
                      #{items.findIndex((x) => x.documentId === item.documentId) + 1}
                    </div>
                  </div>

                  <div className='mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600'>
                    <span className='inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-teal-700'>
                      <Tags className='w-4 h-4' />
                      {item.icon || '—'}
                    </span>
                  </div>

                  <div className='mt-4 grid grid-cols-2 gap-2'>
                    <Button
                      size='sm'
                      variant='secondary'
                      className='w-full'
                      onClick={() => openEditModal(item)}
                      aria-label={t('admin_spec.edit_aria')}
                    >
                      <Pencil className='w-4 h-4' />
                      {t('common.edit')}
                    </Button>
                    <Button
                      size='sm'
                      variant='secondary'
                      className='w-full'
                      onClick={() => handleDelete(item)}
                      aria-label={t('admin_spec.delete_aria')}
                    >
                      <Trash2 className='w-4 h-4 text-rose-600' />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className='hidden overflow-x-auto md:block'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-slate-200'>
                  <th className='text-left py-4 px-4 font-medium text-slate-500 w-14'></th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_spec.col_name')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_spec.col_desc')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_spec.col_icon')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_spec.col_order')}</th>
                  <th className='text-right py-4 px-6 font-medium text-slate-500'>{t('admin_spec.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='text-center py-10 text-slate-500'>
                      {t('admin_spec.not_found')}
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
                            aria-label={t('admin_spec.edit_aria')}
                          >
                            <Pencil className='w-4 h-4' />
                          </Button>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => handleDelete(item)}
                            aria-label={t('admin_spec.delete_aria')}
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
        title={editingItem ? t('admin_spec.modal_title_edit') : t('admin_spec.modal_title_add')}
        size='lg'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {editingItem ? t('admin_spec.save') : t('admin_spec.create')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className='space-y-4'>
          <Input
            label={t('admin_spec.label_name')}
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={t('admin_spec.placeholder_name')}
          />

          <Textarea
            label={t('admin_spec.label_desc')}
            rows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder={t('admin_spec.placeholder_desc')}
          />

          <Input
            label={t('admin_spec.label_order')}
            value={editingItem ? String((editingItem.sortOrder || 0) || 1) : String((items?.length || 0) + 1)}
            disabled
            hint={t('admin_spec.hint_order')}
          />

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label={t('admin_spec.label_icon')}
              value={form.icon}
              onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
              placeholder={t('admin_spec.placeholder_icon')}
              hint={t('admin_spec.hint_icon')}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default AdminSpecializations
