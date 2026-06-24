import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import api from '../../services/api'
import { getPasswordError } from '../../utils/helpers'

const defaultForm = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  fullName: '',
  phone: '',
  iin: '',
  birthDate: '',
  gender: '',
}

const extractCreatedUser = (response) => {
  if (!response?.data) return null
  if (response.data.user?.id) return response.data.user
  if (response.data.id) return response.data
  if (response.data.data?.id) return response.data.data
  return null
}

const findRoleId = (roles, roleType) => {
  const normalizedType = String(roleType || '').toLowerCase()
  return (
    roles.find((role) => String(role?.type || '').toLowerCase() === normalizedType)?.id ||
    roles.find((role) => String(role?.name || '').toLowerCase() === normalizedType)?.id ||
    null
  )
}

function AdminCreateUserModal({ isOpen, role = 'patient', onClose, onCreated }) {
  const { t } = useTranslation()
  const [form, setForm] = useState(defaultForm)
  const [roleId, setRoleId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const isPatient = role === 'patient'
  const roleLabel = isPatient ? t('admin_create_user.role_patient') : t('admin_create_user.role_admin')

  useEffect(() => {
    if (!isOpen) return

    setForm(defaultForm)
    setError('')
    setRoleId(null)

    const loadRole = async () => {
      try {
        const usersRes = await api.get('/api/users?populate[role][fields][0]=id&populate[role][fields][1]=type&populate[role][fields][2]=name&pagination[limit]=1000')
        const users = Array.isArray(usersRes.data) ? usersRes.data : []
        const roleFromUsers =
          users.find((user) => user?.role?.type === role)?.role?.id ||
          users.find((user) => user?.userRole === role && user?.role?.id)?.role?.id ||
          null

        if (roleFromUsers) {
          setRoleId(roleFromUsers)
          return
        }
      } catch (usersError) {
        console.warn(`Could not infer ${role} role from users list:`, usersError)
      }

      try {
        const rolesRes = await api.get('/api/users-permissions/roles')
        const roles = rolesRes?.data?.roles || rolesRes?.data || []
        setRoleId(findRoleId(Array.isArray(roles) ? roles : [], role))
      } catch (roleError) {
        console.warn(`Could not fetch ${role} role:`, roleError)
      }
    }

    loadRole()
  }, [isOpen, role])

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const validate = () => {
    if (!form.username.trim()) return t('admin_create_user.err_login')
    if (!form.fullName.trim()) return t('admin_create_user.err_name')
    if (!form.email.trim()) return t('admin_create_user.err_email')
    const passwordErrorKey = getPasswordError(form.password)
    if (passwordErrorKey) return t(passwordErrorKey)
    if (form.password !== form.confirmPassword) return t('admin_create_user.err_password_mismatch')
    if (form.iin && !/^\d{12}$/.test(form.iin.trim())) return t('admin_create_user.err_iin')
    return ''
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmed: true,
        blocked: false,
        userRole: role,
        fullName: form.fullName.trim(),
      }

      if (roleId) payload.role = roleId
      if (form.phone.trim()) payload.phone = form.phone.trim()
      if (form.iin.trim()) payload.iin = form.iin.trim()
      if (form.birthDate) payload.birthDate = form.birthDate
      if (form.gender) payload.gender = form.gender

      const response = await api.post('/api/users', payload)
      const created = extractCreatedUser(response) || { ...payload, id: response?.data?.id }

      onCreated?.(created)
      onClose()
    } catch (saveError) {
      console.error(`Error creating ${role}:`, saveError)
      const message = saveError?.response?.data?.error?.message || saveError?.message || t('admin_create_user.err_save')
      setError(t('admin_create_user.err_save_msg', { message }))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('admin_create_user.title', { role: roleLabel })}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} isLoading={isSaving}>
            {t('admin_create_user.create')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label={t('admin_create_user.label_login')}
            required
            value={form.username}
            onChange={(e) => updateField('username', e.target.value)}
            placeholder={isPatient ? 'patient_ivanov' : 'admin_ivanov'}
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder={isPatient ? 'patient@example.com' : 'admin@example.com'}
          />
        </div>

        <Input
          label={t('admin_create_user.label_name')}
          required
          value={form.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          placeholder={t('admin_create_user.placeholder_name')}
        />

        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label={t('admin_create_user.label_password')}
            type="password"
            required
            value={form.password}
            onChange={(e) => updateField('password', e.target.value)}
            placeholder={t('admin_create_user.placeholder_password')}
          />
          <Input
            label={t('admin_create_user.label_confirm')}
            type="password"
            required
            value={form.confirmPassword}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
            placeholder={t('admin_create_user.placeholder_confirm')}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Input
            label={t('admin_create_user.label_phone')}
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+7 700 000-00-00"
          />
          {isPatient ? (
            <Input
              label={t('admin_create_user.label_iin')}
              value={form.iin}
              onChange={(e) => updateField('iin', e.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="000000000000"
              maxLength={12}
            />
          ) : (
            <div />
          )}
        </div>

        {isPatient && (
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              label={t('admin_create_user.label_birth_date')}
              type="date"
              value={form.birthDate}
              onChange={(e) => updateField('birthDate', e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">
                {t('admin_create_user.label_gender')}
              </label>
              <select
                value={form.gender}
                onChange={(e) => updateField('gender', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">{t('admin_create_user.gender_empty')}</option>
                <option value="male">{t('admin_create_user.gender_male')}</option>
                <option value="female">{t('admin_create_user.gender_female')}</option>
              </select>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}

export default AdminCreateUserModal
