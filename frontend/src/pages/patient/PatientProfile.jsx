import { useState } from 'react'
import { User, Mail, Phone, Calendar, CreditCard, Shield, Bell, LogOut } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Avatar from '../../components/ui/Avatar'
import useAuthStore from '../../stores/authStore'
import { formatDate } from '../../utils/helpers'

function PatientProfile() {
  const { user, updateProfile, logout } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    iin: user?.iin || '',
    birthDate: user?.birthDate || '',
    address: user?.address || '',
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    await updateProfile(formData)
    setIsSaving(false)
    setIsEditing(false)
  }

  const profileFields = [
    { name: 'fullName', label: 'ФИО', icon: User, type: 'text' },
    { name: 'email', label: 'Email', icon: Mail, type: 'email' },
    { name: 'phone', label: 'Телефон', icon: Phone, type: 'tel' },
    { name: 'iin', label: 'ИИН', icon: CreditCard, type: 'text' },
    { name: 'birthDate', label: 'Дата рождения', icon: Calendar, type: 'date' },
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
              Пациент с {formatDate(user?.createdAt || new Date(), 'MMMM yyyy')}
            </p>
          </div>
          <div className="sm:ml-auto">
            {isEditing ? (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setIsEditing(false)}>
                  Отмена
                </Button>
                <Button onClick={handleSave} isLoading={isSaving}>
                  Сохранить
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Редактировать
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Личные данные</CardTitle>
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

      {/* Settings */}
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Безопасность
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              Изменить пароль
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Двухфакторная аутентификация
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Активные сессии
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Уведомления
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-700">Email уведомления</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700">SMS уведомления</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-700">Напоминания о записях</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Danger Zone */}
      <Card className="border-rose-200">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-slate-900">Выйти из аккаунта</h3>
              <p className="text-sm text-slate-500">Завершить текущую сессию</p>
            </div>
            <Button
              variant="danger"
              leftIcon={<LogOut className="w-4 h-4" />}
              onClick={logout}
            >
              Выйти
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PatientProfile
