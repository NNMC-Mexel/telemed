import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Phone, Calendar, CreditCard, Shield, Bell, LogOut, Languages, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Avatar from '../../components/ui/Avatar'
import useAuthStore from '../../stores/authStore'
import api from '../../services/api'
import { formatDate, cn } from '../../utils/helpers'

function ChangePasswordModal({ onClose }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ currentPassword: '', password: '', passwordConfirmation: '' })
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))
  const toggle = (field) => setShow(prev => ({ ...prev, [field]: !prev[field] }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.passwordConfirmation) {
      setError(t('auth.register.validation.confirm_password'))
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      await api.post('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        password: form.password,
        passwordConfirmation: form.passwordConfirmation,
      })
      setSuccess(true)
    } catch (err) {
      const msg = err.response?.data?.error?.message || t('profile.password_change_error')
      setError(msg === 'Invalid credentials' ? t('profile.current_password_wrong') : msg)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900 mb-2">{t('profile.password_changed')}</h3>
          <p className="text-slate-500 mb-6 text-sm">{t('profile.password_changed_desc')}</p>
          <Button className="w-full" onClick={onClose}>{t('common.close')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">{t('profile.change_password')}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('profile.current_password')}
            type={show.current ? 'text' : 'password'}
            value={form.currentPassword}
            onChange={handleChange('currentPassword')}
            rightIcon={
              <button type="button" onClick={() => toggle('current')} className="text-slate-400 hover:text-slate-600">
                {show.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
          />
          <Input
            label={t('profile.new_password')}
            type={show.next ? 'text' : 'password'}
            value={form.password}
            onChange={handleChange('password')}
            rightIcon={
              <button type="button" onClick={() => toggle('next')} className="text-slate-400 hover:text-slate-600">
                {show.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
          />
          <Input
            label={t('profile.confirm_new_password')}
            type={show.confirm ? 'text' : 'password'}
            value={form.passwordConfirmation}
            onChange={handleChange('passwordConfirmation')}
            rightIcon={
              <button type="button" onClick={() => toggle('confirm')} className="text-slate-400 hover:text-slate-600">
                {show.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            required
          />
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              {t('profile.cancel')}
            </Button>
            <Button type="submit" className="flex-1" isLoading={isLoading}>
              {t('profile.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PatientProfile() {
  const { t } = useTranslation()
  const { user, updateProfile, logout } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // null | 'success' | 'error'
  const [saveError, setSaveError] = useState(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [transLang, setTransLang] = useState('kk')
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    iin: user?.iin || '',
    birthDate: user?.birthDate || '',
    i18n: user?.i18n || {},
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleI18nChange = (lang, value) => {
    setFormData((prev) => ({
      ...prev,
      i18n: { ...prev.i18n, [lang]: { ...(prev.i18n?.[lang] || {}), fullName: value } },
    }))
  }

  const handleEdit = () => {
    setFormData({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      iin: user?.iin || '',
      birthDate: user?.birthDate || '',
      i18n: user?.i18n || {},
    })
    setSaveStatus(null)
    setSaveError(null)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setSaveStatus(null)
    setSaveError(null)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus(null)
    setSaveError(null)
    const result = await updateProfile({
      fullName: formData.fullName,
      phone: formData.phone,
      iin: formData.iin,
      birthDate: formData.birthDate || null,
      i18n: formData.i18n,
    })
    setIsSaving(false)
    if (result?.success) {
      setSaveStatus('success')
      setIsEditing(false)
      setTimeout(() => setSaveStatus(null), 3000)
    } else {
      setSaveError(result?.error || t('profile.save_error'))
    }
  }

  const profileFields = [
    { name: 'fullName', label: t('profile.full_name'), icon: User, type: 'text' },
    { name: 'phone', label: t('profile.phone'), icon: Phone, type: 'tel' },
    { name: 'iin', label: t('profile.iin'), icon: CreditCard, type: 'text' },
    { name: 'birthDate', label: t('profile.birth_date'), icon: Calendar, type: 'date' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {/* Profile Header */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <Avatar
              src={user?.avatar?.url}
              name={user?.fullName || user?.username}
              size="2xl"
            />
            <button className="absolute bottom-0 right-0 w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors">
              <User className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {user?.fullName || user?.username}
            </h1>
            <p className="text-slate-600">{user?.email}</p>
            <p className="text-sm text-slate-500 mt-1">
              {t('profile.patient_since', { date: formatDate(user?.createdAt || new Date(), 'MMMM yyyy') })}
            </p>
            {saveStatus === 'success' && (
              <div className="mt-2 flex items-center gap-1.5 text-teal-600 text-sm">
                <CheckCircle className="w-4 h-4" />
                {t('profile.save_success')}
              </div>
            )}
          </div>
          <div className="sm:ml-auto">
            {isEditing ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleCancel}>
                  {t('profile.cancel')}
                </Button>
                <Button onClick={handleSave} isLoading={isSaving}>
                  {t('profile.save')}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={handleEdit}>
                {t('profile.edit')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.personal_data')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email — read-only always */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label={t('profile.email')}
              name="email"
              type="email"
              value={user?.email || ''}
              disabled
              leftIcon={<Mail className="w-4 h-4" />}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {profileFields.map((field) => (
              <Input
                key={field.name}
                label={field.label}
                name={field.name}
                type={field.type}
                value={formData[field.name]}
                onChange={handleChange}
                disabled={!isEditing}
                leftIcon={<field.icon className="w-4 h-4" />}
              />
            ))}
          </div>
          {saveError && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Name translations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-teal-600" />
            {t('profile.translations_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-500">{t('profile.translations_hint')}</p>
          <div className="flex gap-2">
            {[
              { code: 'kk', label: 'Қазақша' },
              { code: 'en', label: 'English' },
            ].map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setTransLang(code)}
                className={cn(
                  'px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                  transLang === code
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Input
            label={`${t('profile.full_name')} (${transLang === 'kk' ? 'Қазақша' : 'English'}) — ${t('profile.optional')}`}
            value={formData.i18n?.[transLang]?.fullName || ''}
            onChange={(e) => handleI18nChange(transLang, e.target.value)}
            disabled={!isEditing}
            placeholder={formData.fullName}
            leftIcon={<User className="w-4 h-4" />}
          />
        </CardContent>
      </Card>

      {/* Settings */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {t('profile.security')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              leftIcon={<Lock className="w-4 h-4" />}
              onClick={() => setShowChangePassword(true)}
            >
              {t('profile.change_password')}
            </Button>
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-sm text-slate-500">{t('profile.two_factor')}</span>
              <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{t('profile.coming_soon')}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-sm text-slate-500">{t('profile.active_sessions')}</span>
              <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">{t('profile.coming_soon')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('profile.notifications_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'email_notif', label: t('profile.email_notif') },
              { key: 'sms_notif', label: t('profile.sms_notif') },
              { key: 'appointment_reminders', label: t('profile.appointment_reminders') },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-slate-700">{label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-rose-200">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">{t('profile.logout_title')}</h3>
              <p className="text-sm text-slate-500">{t('profile.logout_desc')}</p>
            </div>
            <Button
              variant="danger"
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={logout}
            >
              {t('profile.logout')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PatientProfile
