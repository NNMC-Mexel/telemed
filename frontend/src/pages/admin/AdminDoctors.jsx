import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Crop, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import SearchableSelect from '../../components/ui/SearchableSelect'
import Textarea from '../../components/ui/Textarea'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import ImageCropModal from '../../components/ui/ImageCropModal'
import Pagination from '../../components/ui/Pagination'
import Avatar from '../../components/ui/Avatar'
import { useDialog } from '../../components/ui/Dialog'
import AdminCreateUserModal from '../../components/admin/AdminCreateUserModal'
import api, { doctorsAPI, getMediaUrl, normalizeResponse, specializationsAPI, uploadFile } from '../../services/api'
import {
  DEFAULT_WORKING_INTERVALS,
  getDoctorWorkingIntervals,
  validateWorkingIntervals,
} from '../../utils/schedule'

const defaultForm = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  specialization: '',
  experience: '0',
  price: '8000',
  licenseNumber: '',
  position: '',
  workplace: 'ТОО MEXEL HEALTH',
  bio: '',
  education: '',
  isActive: true,
  workStartTime: '09:00',
  workEndTime: '18:00',
  breakStart: '12:00',
  breakEnd: '14:00',
  slotDuration: '30',
  workingDays: '1,2,3,4,5',
  workingIntervals: DEFAULT_WORKING_INTERVALS,
}

const DOCTORS_PER_PAGE = 10
const DEFAULT_WORKPLACES = ['ННМЦ', 'ТОО MEXEL HEALTH']
const STANDARD_SLOT_DURATIONS = [15, 30, 45, 60]

function toPayload(form) {
  const validation = validateWorkingIntervals(form.workingIntervals)
  const workingIntervals = validation.intervals.length
    ? validation.intervals
    : DEFAULT_WORKING_INTERVALS
  const firstInterval = workingIntervals[0]
  const lastInterval = workingIntervals[workingIntervals.length - 1]
  const firstGap = workingIntervals.length > 1
    ? { start: workingIntervals[0].end, end: workingIntervals[1].start }
    : null

  return {
    fullName: form.fullName.trim(),
    specialization: form.specialization ? Number(form.specialization) : null,
    experience: Number(form.experience) || 0,
    price: Number(form.price) || 0,
    licenseNumber: form.licenseNumber.trim(),
    position: form.position.trim(),
    workplace: form.workplace.trim(),
    bio: form.bio || '',
    education: form.education || '',
    isActive: Boolean(form.isActive),
    workStartTime: firstInterval.start,
    workEndTime: lastInterval.end,
    breakStart: firstGap?.start || '',
    breakEnd: firstGap?.end || '',
    slotDuration: Number(form.slotDuration) || 30,
    workingDays: form.workingDays || '1,2,3,4,5',
    workingIntervals,
  }
}

function AdminDoctors() {
  const { t } = useTranslation()
  const dialog = useDialog()
  const [doctors, setDoctors] = useState([])
  const [specializations, setSpecializations] = useState([])
  const [search, setSearch] = useState('')
  const [specFilter, setSpecFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [form, setForm] = useState(defaultForm)
  const [doctorRoleId, setDoctorRoleId] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoEditSource, setPhotoEditSource] = useState('')
  const [removePhoto, setRemovePhoto] = useState(false)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const photoInputRef = useRef(null)

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
        doctorsAPI.getAll({ includeInactive: true }),
        specializationsAPI.getAll(),
      ])

      const { data: doctorsData } = normalizeResponse(doctorsRes)
      const { data: specsData } = normalizeResponse(specsRes)
      const usersRes = await api.get('/api/users?populate[role][fields][0]=id&populate[role][fields][1]=type&populate[role][fields][2]=name&pagination[limit]=1000')
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

  const specializationFilterOptions = useMemo(() => [
    { value: 'all', label: t('admin_doc.filter_all') },
    ...specializationOptions,
  ], [specializationOptions, t])

  const workplaceOptions = useMemo(() => {
    const workplaces = new Set(DEFAULT_WORKPLACES)
    doctors.forEach((doctor) => {
      const workplace = doctor.workplace?.trim()
      if (workplace) workplaces.add(workplace)
    })
    if (form.workplace?.trim()) workplaces.add(form.workplace.trim())

    return [...workplaces].map((workplace) => ({
      value: workplace,
      label: workplace,
    }))
  }, [doctors, form.workplace])

  const slotDurationOptions = useMemo(() => {
    const durations = new Set(STANDARD_SLOT_DURATIONS)
    const currentDuration = Number(form.slotDuration)
    if (Number.isFinite(currentDuration) && currentDuration > 0) durations.add(currentDuration)

    return [...durations]
      .sort((a, b) => a - b)
      .map((duration) => ({
        value: String(duration),
        label: t(`schedule.min_${duration}`, { defaultValue: `${duration} ${t('schedule.min_abbr')}` }),
      }))
  }, [form.slotDuration, t])

  const filteredDoctors = useMemo(() => {
    return (doctors || []).filter((doctor) => {
      const matchesSearch =
        !search ||
        doctor.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        doctor.bio?.toLowerCase().includes(search.toLowerCase())

      const doctorSpecId =
        typeof doctor.specialization === 'object' ? String(doctor.specialization?.id) : String(doctor.specialization || '')
      const matchesSpec = specFilter === 'all' || doctorSpecId === specFilter
      const isActive = doctor.isActive !== false
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && isActive) ||
        (statusFilter === 'inactive' && !isActive)

      return matchesSearch && matchesSpec && matchesStatus
    })
  }, [doctors, search, specFilter, statusFilter])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, specFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filteredDoctors.length / DOCTORS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const paginatedDoctors = filteredDoctors.slice(
    (safeCurrentPage - 1) * DOCTORS_PER_PAGE,
    safeCurrentPage * DOCTORS_PER_PAGE
  )

  const openCreateModal = () => {
    setEditingDoctor(null)
    setForm({
      ...defaultForm,
      workingIntervals: DEFAULT_WORKING_INTERVALS.map((interval) => ({ ...interval })),
    })
    setPhotoFile(null)
    setPhotoPreview('')
    setPhotoEditSource('')
    setCropImageSrc(null)
    setRemovePhoto(false)
    setIsModalOpen(true)
  }

  const updateWorkingInterval = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      workingIntervals: prev.workingIntervals.map((interval, currentIndex) =>
        currentIndex === index ? { ...interval, [field]: value } : interval
      ),
    }))
  }

  const addWorkingInterval = () => {
    setForm((prev) => {
      const lastInterval = prev.workingIntervals[prev.workingIntervals.length - 1]
      const nextStart = lastInterval?.end || '09:00'
      return {
        ...prev,
        workingIntervals: [
          ...prev.workingIntervals,
          { start: nextStart, end: '23:30' },
        ],
      }
    })
  }

  const removeWorkingInterval = (index) => {
    setForm((prev) => ({
      ...prev,
      workingIntervals:
        prev.workingIntervals.length > 1
          ? prev.workingIntervals.filter((_, currentIndex) => currentIndex !== index)
          : prev.workingIntervals,
    }))
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
      licenseNumber: doctor.licenseNumber || '',
      position: doctor.position || '',
      workplace: doctor.workplace || 'ННМЦ',
      bio: doctor.bio || '',
      education: doctor.education || '',
      isActive: doctor.isActive !== false,
      workStartTime: doctor.workStartTime || '09:00',
      workEndTime: doctor.workEndTime || '18:00',
      breakStart: doctor.breakStart || '12:00',
      breakEnd: doctor.breakEnd || '14:00',
      slotDuration: String(doctor.slotDuration || 30),
      workingDays: doctor.workingDays || '1,2,3,4,5',
      workingIntervals: getDoctorWorkingIntervals(doctor),
    })
    const photoUrl = getMediaUrl(doctor.photo) || ''
    setPhotoFile(null)
    setPhotoPreview(photoUrl)
    setPhotoEditSource(photoUrl)
    setCropImageSrc(null)
    setRemovePhoto(false)
    setIsModalOpen(true)
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      dialog.alert(t('admin_doc.err_image_only'))
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      dialog.alert(t('admin_doc.err_size'))
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
    setPhotoEditSource(cropImageSrc)
    setRemovePhoto(false)
  }

  const handlePhotoEdit = () => {
    if (!photoPreview) {
      photoInputRef.current?.click()
      return
    }

    setCropImageSrc(photoEditSource || photoPreview)
    setCropModalOpen(true)
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview('')
    setPhotoEditSource('')
    setCropImageSrc(null)
    setRemovePhoto(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()

    if (!form.username.trim()) {
      dialog.alert(t('admin_doc.err_login'))
      return
    }

    if (!form.email.trim()) {
      dialog.alert(t('admin_doc.err_email'))
      return
    }

    if (!form.fullName.trim()) {
      dialog.alert(t('admin_doc.err_name'))
      return
    }

    if (!form.price || Number(form.price) < 0) {
      dialog.alert(t('admin_doc.err_price'))
      return
    }

    if (!form.licenseNumber.trim()) {
      dialog.alert(t('admin_doc.err_license'))
      return
    }

    if ((!editingDoctor || !(extractUser(editingDoctor.users_permissions_user)?.id)) && !form.password) {
      dialog.alert(t('admin_doc.err_password'))
      return
    }

    if (!doctorRoleId && (!editingDoctor || !(extractUser(editingDoctor.users_permissions_user)?.id))) {
      dialog.alert(t('admin_doc.err_no_role'))
      return
    }

    if (form.password && form.password.length < 6) {
      dialog.alert(t('admin_doc.err_short_password'))
      return
    }

    if (form.password !== form.confirmPassword) {
      dialog.alert(t('admin_doc.err_password_mismatch'))
      return
    }

    const intervalValidation = validateWorkingIntervals(form.workingIntervals)
    if (intervalValidation.error) {
      const messages = {
        empty: t('admin_doc.err_interval_empty'),
        invalid: t('admin_doc.err_interval_invalid'),
        overlap: t('admin_doc.err_interval_overlap'),
      }
      dialog.alert(messages[intervalValidation.error] || t('admin_doc.err_schedule'))
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
      setForm({
        ...defaultForm,
        workingIntervals: DEFAULT_WORKING_INTERVALS.map((interval) => ({ ...interval })),
      })
      setPhotoFile(null)
      setPhotoPreview('')
      setPhotoEditSource('')
      setCropImageSrc(null)
      setRemovePhoto(false)
      await loadData()
    } catch (error) {
      console.error('Error saving doctor:', error)
      const message = error?.response?.data?.error?.message || error?.message || t('admin_doc.err_save')
      dialog.alert(t('admin_doc.err_save_msg', { message }))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (doctor) => {
    if (!doctor?.documentId) return

    const confirmed = await dialog.confirm(t('admin_doc.confirm_delete', { name: doctor.fullName }))
    if (!confirmed) return

    try {
      await doctorsAPI.delete(doctor.documentId)
      await loadData()
    } catch (error) {
      console.error('Error deleting doctor:', error)
      dialog.alert(t('admin_doc.err_delete'))
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
          <h1 className='text-2xl font-bold text-slate-900'>{t('admin_doc.title')}</h1>
          <p className='text-slate-600'>{t('admin_doc.subtitle')}</p>
        </div>
        <div className='grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2'>
          <Button className='w-full' variant='outline' leftIcon={<Plus className='w-4 h-4' />} onClick={() => setIsPatientModalOpen(true)}>
            {t('admin_doc.add_patient_btn')}
          </Button>
          <Button className='w-full' leftIcon={<Plus className='w-4 h-4' />} onClick={openCreateModal}>
            {t('admin_doc.add_btn')}
          </Button>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,1fr)_minmax(200px,0.7fr)]'>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin_doc.search_placeholder')}
          leftIcon={<Search className='w-4 h-4' />}
        />
        <SearchableSelect
          value={specFilter}
          onChange={setSpecFilter}
          options={specializationFilterOptions}
          placeholder={t('admin_doc.filter_placeholder')}
          ariaLabel={t('admin_doc.filter_placeholder')}
          searchPlaceholder={t('admin_doc.filter_search_placeholder')}
          noResultsText={t('admin_doc.filter_no_results')}
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: 'all', label: t('admin_doc.status_filter_all') },
            { value: 'active', label: t('admin_doc.status_filter_active') },
            { value: 'inactive', label: t('admin_doc.status_filter_inactive') },
          ]}
          aria-label={t('admin_doc.status_filter_placeholder')}
          placeholder={t('admin_doc.status_filter_placeholder')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin_doc.list_title', { count: filteredDoctors.length })}</CardTitle>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='divide-y divide-slate-100 md:hidden'>
            {filteredDoctors.length === 0 ? (
              <div className='px-4 py-10 text-center text-slate-500'>
                {t('admin_doc.not_found')}
              </div>
            ) : (
              paginatedDoctors.map((doctor) => (
                <div key={doctor.documentId || doctor.id} className='p-4'>
                  <div className='flex items-start gap-3'>
                    <Avatar src={getMediaUrl(doctor.photo)} name={doctor.fullName} size='md' />
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-start justify-between gap-2'>
                        <p className='font-semibold text-slate-900 break-words'>{doctor.fullName}</p>
                        <Badge variant={doctor.isActive === false ? 'danger' : 'success'} className='shrink-0'>
                          {doctor.isActive === false ? t('admin_doc.inactive') : t('admin_doc.active')}
                        </Badge>
                      </div>
                      <p className='mt-1 text-sm text-slate-500 break-words'>
                        {typeof doctor.specialization === 'object'
                          ? doctor.specialization?.name || t('admin_doc.no_spec')
                          : doctor.specialization || t('admin_doc.no_spec')}
                      </p>
                    </div>
                  </div>
                  <div className='mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm'>
                    <div>
                      <p className='text-xs text-slate-400'>{t('admin_doc.col_license')}</p>
                      <p className='font-medium text-slate-900 wrap-break-word'>{doctor.licenseNumber || '—'}</p>
                    </div>
                    <div>
                      <p className='text-xs text-slate-400'>{t('admin_doc.col_exp')}</p>
                      <p className='font-medium text-slate-900'>{t('admin_doc.exp_years', { count: doctor.experience || 0 })}</p>
                    </div>
                    <div>
                      <p className='text-xs text-slate-400'>{t('admin_doc.col_price')}</p>
                      <p className='font-medium text-slate-900'>{(doctor.price || 0).toLocaleString('ru-RU')} ₸</p>
                    </div>
                  </div>
                  <div className='mt-4 grid grid-cols-2 gap-2'>
                    <Button
                      size='sm'
                      variant='secondary'
                      className='w-full'
                      onClick={() => openEditModal(doctor)}
                      aria-label={t('admin_doc.edit_aria')}
                    >
                      <Pencil className='w-4 h-4' />
                      {t('common.edit')}
                    </Button>
                    <Button
                      size='sm'
                      variant='secondary'
                      className='w-full'
                      onClick={() => handleDelete(doctor)}
                      aria-label={t('admin_doc.delete_aria')}
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
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_name')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_spec')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_license')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_exp')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_price')}</th>
                  <th className='text-left py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_status')}</th>
                  <th className='text-right py-4 px-6 font-medium text-slate-500'>{t('admin_doc.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.length === 0 ? (
                  <tr>
                    <td colSpan={7} className='text-center py-10 text-slate-500'>
                      {t('admin_doc.not_found')}
                    </td>
                  </tr>
                ) : (
                  paginatedDoctors.map((doctor) => (
                    <tr key={doctor.documentId || doctor.id} className='border-b border-slate-100 hover:bg-slate-50'>
                      <td className='py-4 px-6 font-medium text-slate-900'>{doctor.fullName}</td>
                      <td className='py-4 px-6 text-slate-600'>
                        {typeof doctor.specialization === 'object'
                          ? doctor.specialization?.name || t('admin_doc.no_spec')
                          : doctor.specialization || t('admin_doc.no_spec')}
                      </td>
                      <td className='py-4 px-6 text-slate-600'>{doctor.licenseNumber || '—'}</td>
                      <td className='py-4 px-6 text-slate-600'>
                        {t('admin_doc.exp_years', { count: doctor.experience || 0 })}
                      </td>
                      <td className='py-4 px-6 text-slate-600'>
                        {(doctor.price || 0).toLocaleString('ru-RU')} ₸
                      </td>
                      <td className='py-4 px-6'>
                        <Badge variant={doctor.isActive === false ? 'danger' : 'success'}>
                          {doctor.isActive === false ? t('admin_doc.inactive') : t('admin_doc.active')}
                        </Badge>
                      </td>
                      <td className='py-4 px-6'>
                        <div className='flex justify-end gap-2'>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => openEditModal(doctor)}
                            aria-label={t('admin_doc.edit_aria')}
                          >
                            <Pencil className='w-4 h-4' />
                          </Button>
                          <Button
                            size='icon'
                            variant='secondary'
                            onClick={() => handleDelete(doctor)}
                            aria-label={t('admin_doc.delete_aria')}
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
          <Pagination
            currentPage={safeCurrentPage}
            totalItems={filteredDoctors.length}
            pageSize={DOCTORS_PER_PAGE}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDoctor ? t('admin_doc.modal_title_edit') : t('admin_doc.modal_title_add')}
        size='xl'
        footer={
          <>
            <Button variant='secondary' onClick={() => setIsModalOpen(false)} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {editingDoctor ? t('admin_doc.save') : t('admin_doc.create')}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSave} className='space-y-4'>
          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label={t('admin_doc.label_login')}
              required
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              placeholder={t('admin_doc.placeholder_login')}
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
              label={editingDoctor ? t('admin_doc.label_password_new') : t('admin_doc.label_password')}
              type='password'
              required={!editingDoctor}
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={editingDoctor ? t('admin_doc.placeholder_password_new') : t('admin_doc.placeholder_password')}
              hint={editingDoctor ? t('admin_doc.hint_password') : undefined}
            />
            <Input
              label={editingDoctor ? t('admin_doc.label_confirm_new') : t('admin_doc.label_confirm')}
              type='password'
              required={!editingDoctor}
              value={form.confirmPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder={t('admin_doc.placeholder_confirm')}
            />
          </div>

          <div className='flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200'>
            <input
              ref={photoInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={handlePhotoSelect}
            />
            <button
              type='button'
              onClick={handlePhotoEdit}
              aria-label={photoPreview ? t('admin_doc.adjust_photo') : t('admin_doc.upload_photo')}
              title={photoPreview ? t('admin_doc.adjust_photo') : t('admin_doc.upload_photo')}
              className='group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2'>
              {photoPreview ? (
                <img src={photoPreview} alt={t('admin_doc.photo_alt')} className='w-full h-full object-cover' />
              ) : (
                <span className='flex h-full w-full items-center justify-center'>
                  <Camera className='w-8 h-8 text-slate-500' />
                </span>
              )}
              <span className='absolute inset-0 flex items-center justify-center bg-slate-950/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
                <Camera className='h-6 w-6' />
              </span>
            </button>
            <div>
              <div className='flex flex-wrap gap-2'>
                {photoPreview && (
                  <Button
                    type='button'
                    variant='secondary'
                    onClick={handlePhotoEdit}
                    leftIcon={<Crop className='w-4 h-4' />}>
                    {t('admin_doc.adjust_photo')}
                  </Button>
                )}
                <Button
                  type='button'
                  variant='secondary'
                  onClick={() => photoInputRef.current?.click()}
                  leftIcon={<Camera className='w-4 h-4' />}>
                  {photoPreview ? t('admin_doc.replace_photo') : t('admin_doc.upload_photo')}
                </Button>
                {photoPreview && (
                  <Button type='button' variant='secondary' onClick={handleRemovePhoto} leftIcon={<X className='w-4 h-4' />}>
                    {t('admin_doc.remove_photo')}
                  </Button>
                )}
              </div>
              <p className='mt-2 text-xs text-slate-500'>
                {photoPreview ? t('admin_doc.adjust_photo_hint') : t('admin_doc.click_photo_hint')}
              </p>
            </div>
          </div>

          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label={t('admin_doc.label_name')}
              required
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder={t('admin_doc.placeholder_name')}
            />
            <Select
              label={t('admin_doc.label_spec')}
              value={form.specialization}
              onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
              options={specializationOptions}
              placeholder={t('admin_doc.placeholder_spec')}
            />
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label={t('admin_doc.label_license')}
              required
              value={form.licenseNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, licenseNumber: e.target.value }))}
              placeholder={t('admin_doc.placeholder_license')}
            />
            <Input
              label={t('admin_doc.label_position')}
              value={form.position}
              onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))}
              placeholder={t('admin_doc.placeholder_position')}
            />
            <Select
              label={t('admin_doc.label_workplace')}
              value={form.workplace}
              onChange={(e) => setForm((prev) => ({ ...prev, workplace: e.target.value }))}
              options={workplaceOptions}
              placeholder={t('admin_doc.placeholder_workplace')}
            />
          </div>

          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label={t('admin_doc.label_exp')}
              type='number'
              min='0'
              value={form.experience}
              onChange={(e) => setForm((prev) => ({ ...prev, experience: e.target.value }))}
            />
            <Input
              label={t('admin_doc.label_price')}
              type='number'
              min='0'
              required
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
            />
            <Select
              label={t('admin_doc.label_duration')}
              value={form.slotDuration}
              onChange={(e) => setForm((prev) => ({ ...prev, slotDuration: e.target.value }))}
              options={slotDurationOptions}
            />
          </div>

          <div className='space-y-3'>
            <div className='flex items-center justify-between gap-3'>
              <label className='block text-sm font-medium text-slate-700'>
                {t('admin_doc.label_working_intervals')}
              </label>
              <Button
                type='button'
                variant='outline'
                size='sm'
                leftIcon={<Plus className='w-4 h-4' />}
                onClick={addWorkingInterval}>
                {t('admin_doc.add_interval')}
              </Button>
            </div>
            <div className='space-y-3'>
              {form.workingIntervals.map((interval, index) => (
                <div
                  key={`${index}-${interval.start}-${interval.end}`}
                  className='grid grid-cols-[1fr_1fr_40px] gap-3 items-end'>
                  <Input
                    label={index === 0 ? t('admin_doc.label_start') : t('admin_doc.label_interval_start')}
                    value={interval.start}
                    onChange={(e) => updateWorkingInterval(index, 'start', e.target.value)}
                    placeholder='09:00'
                  />
                  <Input
                    label={index === 0 ? t('admin_doc.label_end') : t('admin_doc.label_interval_end')}
                    value={interval.end}
                    onChange={(e) => updateWorkingInterval(index, 'end', e.target.value)}
                    placeholder='18:00'
                  />
                  <button
                    type='button'
                    title='Удалить интервал'
                    aria-label='Удалить интервал'
                    onClick={() => removeWorkingInterval(index)}
                    disabled={form.workingIntervals.length === 1}
                    className='h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors'>
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <Input
            label={t('admin_doc.label_working_days')}
            value={form.workingDays}
            onChange={(e) => setForm((prev) => ({ ...prev, workingDays: e.target.value }))}
            placeholder='1,2,3,4,5'
            hint={t('admin_doc.hint_working_days')}
          />

          <Textarea
            label={t('admin_doc.label_education')}
            rows={3}
            value={form.education}
            onChange={(e) => setForm((prev) => ({ ...prev, education: e.target.value }))}
            placeholder={t('admin_doc.placeholder_education')}
          />

          <Textarea
            label={t('admin_doc.label_bio')}
            rows={4}
            value={form.bio}
            onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))}
            placeholder={t('admin_doc.placeholder_bio')}
          />

          <label className='flex items-center gap-2 text-sm text-slate-700'>
            <input
              type='checkbox'
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              className='rounded border-slate-300 text-teal-600 focus:ring-teal-500'
            />
            {t('admin_doc.label_active')}
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

      <AdminCreateUserModal
        isOpen={isPatientModalOpen}
        role='patient'
        onClose={() => setIsPatientModalOpen(false)}
      />
    </div>
  )
}

export default AdminDoctors
