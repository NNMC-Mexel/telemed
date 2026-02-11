import { useEffect, useMemo, useState } from 'react'
import { Camera, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Textarea from '../../components/ui/Textarea'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import ImageCropModal from '../../components/ui/ImageCropModal'
import api, { doctorsAPI, getMediaUrl, normalizeResponse, specializationsAPI, uploadFile } from '../../services/api'

const defaultForm = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  specialization: '',
  experience: '0',
  price: '8000',
  bio: '',
  education: '',
  isActive: true,
  workStartTime: '09:00',
  workEndTime: '18:00',
  breakStart: '12:00',
  breakEnd: '14:00',
  slotDuration: '30',
  workingDays: '1,2,3,4,5',
}

function toPayload(form) {
  return {
    fullName: form.fullName.trim(),
    specialization: form.specialization ? Number(form.specialization) : null,
    experience: Number(form.experience) || 0,
    price: Number(form.price) || 0,
    bio: form.bio || '',
    education: form.education || '',
    isActive: Boolean(form.isActive),
    workStartTime: form.workStartTime || '09:00',
    workEndTime: form.workEndTime || '18:00',
    breakStart: form.breakStart || '12:00',
    breakEnd: form.breakEnd || '14:00',
    slotDuration: Number(form.slotDuration) || 30,
    workingDays: form.workingDays || '1,2,3,4,5',
  }
}

function AdminDoctors() {
  const [doctors, setDoctors] = useState([])
  const [specializations, setSpecializations] = useState([])
  const [search, setSearch] = useState('')
  const [specFilter, setSpecFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [doctorRoleId, setDoctorRoleId] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState(null)

  const extractUser = (value) => {
    if (!value) return null
    if (Array.isArray(value)) return value[0] || null
    return value
  }

  const extractCreatedUser = (response) => {
    if (!response?.data) return null
    if (response.data.user?.id) return response.data.user
    if (response.data.id) return response.data
    if (response.data.data?.id) return response.data.data
    return null
  }

  const createDoctorUser = async () => {
    if (!doctorRoleId) {
      throw new Error('Doctor role is not configured')
    }

    const payload = {
      username: form.username.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: doctorRoleId,
      confirmed: true,
      blocked: false,
      userRole: 'doctor',
      fullName: form.fullName.trim(),
    }
    const response = await api.post('/api/users', payload)
    const created = extractCreatedUser(response)
    if (!created?.id) {
      throw new Error('Doctor user was not created')
    }
    return created
  }

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [doctorsRes, specsRes] = await Promise.all([
        doctorsAPI.getAll(),
        specializationsAPI.getAll(),
      ])

      const { data: doctorsData } = normalizeResponse(doctorsRes)
      const { data: specsData } = normalizeResponse(specsRes)
      const usersRes = await api.get('/api/users?populate[role][fields][0]=id&populate[role][fields][1]=type&populate[role][fields][2]=name')
      const usersData = Array.isArray(usersRes.data) ? usersRes.data : []
      const usersMap = new Map(usersData.map((user) => [user.id, user]))
      let detectedDoctorRoleId =
        usersData.find((u) => u?.role?.type === 'doctor')?.role?.id ||
        usersData.find((u) => u?.userRole === 'doctor' && u?.role?.id)?.role?.id ||
        null

      if (!detectedDoctorRoleId) {
        try {
          const rolesRes = await api.get('/api/users-permissions/roles')
          const roleList = rolesRes?.data?.roles || rolesRes?.data || []
          detectedDoctorRoleId =
            roleList.find((role) => role?.type === 'doctor')?.id ||
            roleList.find((role) => String(role?.name || '').toLowerCase() === 'doctor')?.id ||
            null
        } catch (roleError) {
          console.warn('Could not fetch roles list:', roleError)
        }
      }

      setDoctorRoleId(detectedDoctorRoleId)

      const normalizedDoctors = (doctorsData || []).map((doctor) => {
        const relationUser = extractUser(doctor.users_permissions_user)
        const linkedByRelation = relationUser?.id ? usersMap.get(relationUser.id) : null
        const linkedByUserId = doctor.userId ? usersMap.get(doctor.userId) : null
        const linkedUser = linkedByRelation || linkedByUserId || relationUser || null
        return {
          ...doctor,
          users_permissions_user: linkedUser,
        }
      })

      setDoctors(normalizedDoctors)
      setSpecializations(specsData || [])
    } catch (error) {
      console.error('Error loading admin doctors:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const specializationOptions = useMemo(
    () =>
      (specializations || []).map((spec) => ({
        value: String(spec.id),
        label: spec.name,
      })),
    [specializations],
  )

  const filteredDoctors = useMemo(() => {
    return (doctors || []).filter((doctor) => {
      const matchesSearch =
        !search ||
        doctor.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        doctor.bio?.toLowerCase().includes(search.toLowerCase())

      const doctorSpecId =
        typeof doctor.specialization === 'object' ? String(doctor.specialization?.id) : String(doctor.specialization || '')
      const matchesSpec = specFilter === 'all' || doctorSpecId === specFilter

      return matchesSearch && matchesSpec
    })
  }, [doctors, search, specFilter])

  const openCreateModal = () => {
    setEditingDoctor(null)
    setForm(defaultForm)
    setPhotoFile(null)
    setPhotoPreview('')
    setRemovePhoto(false)
    setIsModalOpen(true)
  }

  const openEditModal = (doctor) => {
      const linkedUser = extractUser(doctor.users_permissions_user) || null
    setEditingDoctor(doctor)
    setForm({
      username: linkedUser?.username || '',
      email: linkedUser?.email || '',
      password: '',
      confirmPassword: '',
      fullName: doctor.fullName || '',
      specialization:
        typeof doctor.specialization === 'object'
          ? String(doctor.specialization?.id || '')
          : String(doctor.specialization || ''),
      experience: String(doctor.experience || 0),
      price: String(doctor.price || 0),
      bio: doctor.bio || '',
      education: doctor.education || '',
      isActive: doctor.isActive !== false,
      workStartTime: doctor.workStartTime || '09:00',
      workEndTime: doctor.workEndTime || '18:00',
      breakStart: doctor.breakStart || '12:00',
      breakEnd: doctor.breakEnd || '14:00',
      slotDuration: String(doctor.slotDuration || 30),
      workingDays: doctor.workingDays || '1,2,3,4,5',
    })
    setPhotoFile(null)
    setPhotoPreview(getMediaUrl(doctor.photo) || '')
    setRemovePhoto(false)
    setIsModalOpen(true)
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Можно загрузить только изображение')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Максимальный размер файла: 5MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCropImageSrc(reader.result)
      setCropModalOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleCroppedPhoto = async (croppedFile) => {
    setPhotoFile(croppedFile)
    setPhotoPreview(URL.createObjectURL(croppedFile))
    setRemovePhoto(false)
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview('')
    setRemovePhoto(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!form.username.trim()) {
      alert('Введите логин врача')
      return
    }

    if (!form.email.trim()) {
      alert('Введите email врача')
      return
    }

    if (!form.fullName.trim()) {
      alert('Введите ФИО врача')
      return
    }

    if (!form.price || Number(form.price) < 0) {
      alert('Укажите корректную цену')
      return
    }

    if ((!editingDoctor || !(extractUser(editingDoctor.users_permissions_user)?.id)) && !form.password) {
      alert('Введите пароль для нового аккаунта врача')
      return
    }

    if (!doctorRoleId && (!editingDoctor || !(extractUser(editingDoctor.users_permissions_user)?.id))) {
      alert('Роль doctor не найдена. Проверьте роли в Strapi и перезапустите backend.')
      return
    }

    if (form.password && form.password.length < 6) {
      alert('Пароль должен быть минимум 6 символов')
      return
    }

    if (form.password !== form.confirmPassword) {
      alert('Пароли не совпадают')
      return
    }

    setIsSaving(true)
    try {
      const payload = toPayload(form)
      if (photoFile) {
        const uploaded = await uploadFile(photoFile)
        payload.photo = uploaded.id
      } else if (removePhoto) {
        payload.photo = null
      }

      if (editingDoctor?.documentId) {
        const linkedUser = extractUser(editingDoctor.users_permissions_user) || null
        let userId = linkedUser?.id || null

        if (userId) {
          const userPayload = {
            username: form.username.trim(),
            email: form.email.trim().toLowerCase(),
            userRole: 'doctor',
            fullName: form.fullName.trim(),
          }
          if (doctorRoleId) {
            userPayload.role = doctorRoleId
          }
          if (form.password) {
            userPayload.password = form.password
          }
          await api.put(`/api/users/${userId}`, userPayload)
        } else {
          const createdUser = await createDoctorUser()
          userId = createdUser.id
        }

        await doctorsAPI.update(editingDoctor.documentId, {
          ...payload,
          users_permissions_user: userId,
          userId,
        })
      } else {
        const createdUser = await createDoctorUser()
        await doctorsAPI.create({
          ...payload,
          users_permissions_user: createdUser.id,
          userId: createdUser.id,
        })
      }

      setIsModalOpen(false)
      setEditingDoctor(null)
      setForm(defaultForm)
      setPhotoFile(null)
      setPhotoPreview('')
      setRemovePhoto(false)
      await loadData()
    } catch (error) {
      console.error('Error saving doctor:', error)
      const message = error?.response?.data?.error?.message || error?.message || 'Не удалось сохранить врача'
      alert(`Не удалось сохранить врача: ${message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (doctor) => {
    if (!doctor?.documentId) return

    const confirmed = window.confirm(`Удалить врача ${doctor.fullName}?`)
    if (!confirmed) return

    try {
      await doctorsAPI.delete(doctor.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting doctor:', error)
      alert('Не удалось удалить врача')
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
          <h1 className='text-2xl font-bold text-slate-900'>Врачи</h1>
          <p className='text-slate-600'>Создание и управление профилями врачей</p>
        </div>
        <Button leftIcon={<Plus className='w-4 h-4' />} onClick={openCreateModal}>
          Добавить врача
        </Button>
      </div>

      <div className='grid md:grid-cols-2 gap-4'>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Поиск по ФИО или био...'
          leftIcon={<Search className='w-4 h-4' />}
        />
        <Select
          value={specFilter}
          onChange={(e) => setSpecFilter(e.target.value)}
          options={[
            { value: 'all', label: 'Все специализации' },
            ...specializationOptions,
          ]}
          placeholder='Фильтр по специализации'
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Список врачей ({filteredDoctors.length})</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b border-slate-200'>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>ФИО</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>Специализация</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>Стаж</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>Цена</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>Статус</th>
                  <th className='text-right py-4 px-6 font-medium text-slate-500'>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className='text-center py-10 text-slate-500'>
                      Врачи не найдены
                    </td>
                  </tr>
                ) : (
                  filteredDoctors.map((doctor) => (
                    <tr key={doctor.documentId || doctor.id} className='border-b border-slate-100 hover:bg-slate-50'>
                      <td className='py-4 px-6 font-medium text-slate-900'>{doctor.fullName}</td>
                      <td className='py-4 px-6 text-slate-600'>
                        {typeof doctor.specialization === 'object'
                          ? doctor.specialization?.name || 'Не указана'
                          : doctor.specialization || 'Не указана'}
                      </td>
                      <td className='py-4 px-6 text-slate-600'>{doctor.experience || 0} лет</td>
                      <td className='py-4 px-6 text-slate-600'>
                        {(doctor.price || 0).toLocaleString('ru-RU')} ₸
                      </td>
                      <td className='py-4 px-6'>
                        <Badge variant={doctor.isActive === false ? 'danger' : 'success'}>
                          {doctor.isActive === false ? 'Неактивен' : 'Активен'}
                        </Badge>
                      </td>
                      <td className='py-4 px-6'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => openEditModal(doctor)}
                            aria-label='Редактировать'
                          >
                            <Pencil className='w-4 h-4' />
                          </Button>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => handleDelete(doctor)}
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
        title={editingDoctor ? 'Редактировать врача' : 'Добавить врача'}
        size='xl'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              Отмена
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {editingDoctor ? 'Сохранить' : 'Создать'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className='space-y-4'>
          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='Логин'
              required
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder='Например: doctor_ivanov'
            />
            <Input
              label='Email'
              type='email'
              required
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder='doctor@example.com'
            />
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label={editingDoctor ? 'Новый пароль (опционально)' : 'Пароль'}
              type='password'
              required={!editingDoctor}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={editingDoctor ? 'Оставьте пустым, если не менять' : 'Минимум 6 символов'}
              hint={editingDoctor ? 'Текущий пароль не отображается. Чтобы изменить, введите новый.' : undefined}
            />
            <Input
              label={editingDoctor ? 'Подтверждение нового пароля' : 'Подтверждение пароля'}
              type='password'
              required={!editingDoctor}
              value={form.confirmPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder='Повторите пароль'
            />
          </div>

          <div className='flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200'>
            <div className='w-20 h-20 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center'>
              {photoPreview ? (
                <img src={photoPreview} alt='Фото врача' className='w-full h-full object-cover' />
              ) : (
                <Camera className='w-8 h-8 text-slate-500' />
              )}
            </div>
            <div className='flex flex-wrap gap-2'>
              <label className='inline-flex'>
                <input type='file' accept='image/*' className='hidden' onChange={handlePhotoSelect} />
                <span className='inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors'>
                  Загрузить фото
                </span>
              </label>
              {photoPreview && (
                <Button type='button' variant='secondary' onClick={handleRemovePhoto} leftIcon={<X className='w-4 h-4' />}>
                  Удалить фото
                </Button>
              )}
            </div>
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='ФИО'
              required
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder='Например: Иванов Иван Иванович'
            />
            <Select
              label='Специализация'
              value={form.specialization}
              onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
              options={specializationOptions}
              placeholder='Выберите специализацию'
            />
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label='Стаж (лет)'
              type='number'
              min='0'
              value={form.experience}
              onChange={(e) => setForm((prev) => ({ ...prev, experience: e.target.value }))}
            />
            <Input
              label='Цена консультации (₸)'
              type='number'
              min='0'
              required
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
            />
            <Input
              label='Длительность слота (мин)'
              type='number'
              min='10'
              value={form.slotDuration}
              onChange={(e) => setForm((prev) => ({ ...prev, slotDuration: e.target.value }))}
            />
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='Рабочее время: начало'
              value={form.workStartTime}
              onChange={(e) => setForm((prev) => ({ ...prev, workStartTime: e.target.value }))}
              placeholder='09:00'
            />
            <Input
              label='Рабочее время: конец'
              value={form.workEndTime}
              onChange={(e) => setForm((prev) => ({ ...prev, workEndTime: e.target.value }))}
              placeholder='18:00'
            />
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='Перерыв: начало'
              value={form.breakStart}
              onChange={(e) => setForm((prev) => ({ ...prev, breakStart: e.target.value }))}
              placeholder='12:00'
            />
            <Input
              label='Перерыв: конец'
              value={form.breakEnd}
              onChange={(e) => setForm((prev) => ({ ...prev, breakEnd: e.target.value }))}
              placeholder='14:00'
            />
          </div>

          <Input
            label='Рабочие дни (номера дней недели через запятую)'
            value={form.workingDays}
            onChange={(e) => setForm((prev) => ({ ...prev, workingDays: e.target.value }))}
            placeholder='1,2,3,4,5'
            hint='1=Пн, 2=Вт, ..., 7=Вс'
          />

          <Textarea
            label='Образование'
            rows={3}
            value={form.education}
            onChange={(e) => setForm((prev) => ({ ...prev, education: e.target.value }))}
            placeholder='Краткая информация об образовании врача'
          />

          <Textarea
            label='Био / описание'
            rows={4}
            value={form.bio}
            onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
            placeholder='Описание врача для профиля'
          />

          <label className='flex items-center gap-2 text-sm text-slate-700'>
            <input
              type='checkbox'
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className='rounded border-slate-300 text-teal-600 focus:ring-teal-500'
            />
            Профиль активен
          </label>
        </form>
      </Modal>

      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        imageSrc={cropImageSrc}
        onCropComplete={handleCroppedPhoto}
        aspect={1}
      />
    </div>
  )
}

export default AdminDoctors
