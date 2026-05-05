import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Phone, Calendar, CreditCard, Shield, Bell, LogOut, Languages } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Avatar from '../../components/ui/Avatar'
import useAuthStore from '../../stores/authStore'
import { formatDate, cn } from '../../utils/helpers'

function PatientProfile() {
  const { t } = useTranslation()
  const { user, updateProfile, logout } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [transLang, setTransLang] = useState('kk')
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    iin: user?.iin || '',
    birthDate: user?.birthDate || '',
    address: user?.address || '',
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

  const handleSave = async () => {
    setIsSaving(true)
    await updateProfile(formData)
    setIsSaving(false)
    setIsEditing(false)
  }

  const profileFields = [
    { name: 'fullName', label: t('profile.full_name'), icon: User, type: 'text' },
    { name: 'email', label: t('profile.email'), icon: Mail, type: 'email' },
    { name: 'phone', label: t('profile.phone'), icon: Phone, type: 'tel' },
    { name: 'iin', label: t('profile.iin'), icon: CreditCard, type: 'text' },
    { name: 'birthDate', label: t('profile.birth_date'), icon: Calendar, type: 'date' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
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
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-bold text-slate-900">
              {user?.fullName || user?.username}
            </h1>
            <p className="text-slate-600">{user?.email}</p>
            <p className="text-sm text-slate-500 mt-1">
              {t('profile.patient_since', { date: formatDate(user?.createdAt || new Date(), 'MMMM yyyy') })}
            </p>
          </div>
          <div className="sm:ml-auto">
            {isEditing ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsEditing(false)}>
                  {t('profile.cancel')}
                </Button>
                <Button onClick={handleSave} isLoading={isSaving}>
                  {t('profile.save')}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
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
        <CardContent>
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

          {/* Language tabs */}
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
            <Button variant="outline" className="w-full justify-start">
              {t('profile.change_password')}
            </Button>
            <Button variant="outline" className="w-full justify-start">
              {t('profile.two_factor')}
            </Button>
            <Button variant="outline" className="w-full justify-start">
              {t('profile.active_sessions')}
            </Button>
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
