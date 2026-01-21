import { useState } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Mail, Lock, Activity, ArrowLeft, Stethoscope, UserCircle } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import useAuthStore from '../stores/authStore'

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login, isLoading, error, clearError } = useAuthStore()

  // Получаем тип пользователя из URL параметра (?type=doctor или ?type=patient)
  const initialUserType = searchParams.get('type') || 'patient'
  const [userType, setUserType] = useState(initialUserType)

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({})

  const from = location.state?.from?.pathname || (userType === 'doctor' ? '/doctor' : '/patient')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }))
    }
    if (error) clearError()
  }

  const validate = () => {
    const errors = {}
    if (!formData.identifier) {
      errors.identifier = 'Введите email или телефон'
    }
    if (!formData.password) {
      errors.password = 'Введите пароль'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleUserTypeChange = (type) => {
    setUserType(type)
    clearError()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    const result = await login(formData.identifier, formData.password)
    if (result.success) {
      const role = result.user?.userRole || result.user?.role?.type || result.user?.role
      if (role === 'admin') {
        navigate('/admin')
      } else if (role === 'doctor') {
        navigate('/doctor')
      } else {
        navigate('/patient')
      }
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Добро пожаловать
            </h1>
            <p className="text-slate-600">
              Войдите в свой аккаунт для доступа к личному кабинету
            </p>
          </div>

          {/* User Type Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => handleUserTypeChange('patient')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                userType === 'patient'
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <UserCircle className="w-5 h-5" />
              Пациент
            </button>
            <button
              type="button"
              onClick={() => handleUserTypeChange('doctor')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                userType === 'doctor'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Stethoscope className="w-5 h-5" />
              Врач
            </button>
          </div>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Email или телефон"
                  name="identifier"
                  type="text"
                  placeholder="example@mail.com"
                  value={formData.identifier}
                  onChange={handleChange}
                  error={formErrors.identifier}
                  leftIcon={<Mail className="w-5 h-5" />}
                  required
                />

                <Input
                  label="Пароль"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  error={formErrors.password}
                  leftIcon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  }
                  required
                />

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-600">Запомнить меня</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Забыли пароль?
                  </Link>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  isLoading={isLoading}
                >
                  Войти
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center mt-6 text-slate-600">
            Нет аккаунта?{' '}
            <Link
              to="/register"
              className="text-teal-600 hover:text-teal-700 font-medium"
            >
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Decoration */}
      <div className={`hidden lg:flex flex-1 items-center justify-center p-12 relative overflow-hidden transition-all duration-500 ${
        userType === 'doctor' 
          ? 'bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800' 
          : 'bg-gradient-to-br from-teal-600 via-teal-700 to-sky-800'
      }`}>
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-sky-300 rounded-full blur-3xl" />
        </div>

        <div className="relative text-center text-white max-w-md">
          <div className="w-20 h-20 mx-auto mb-8 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur">
            {userType === 'doctor' ? (
              <Stethoscope className="w-10 h-10 text-white" />
            ) : (
            <Activity className="w-10 h-10 text-white" />
            )}
          </div>
          <h2 className="text-3xl font-bold mb-4">
            {userType === 'doctor' ? 'Личный кабинет врача' : 'MedConnect'}
          </h2>
          <p className="text-xl text-white/80 mb-8">
            {userType === 'doctor' 
              ? 'Управляйте расписанием, проводите консультации и помогайте пациентам онлайн'
              : 'Современная платформа телемедицины для онлайн-консультаций с врачами'
            }
          </p>
          <div className="flex items-center justify-center gap-8 text-white/60 text-sm">
            {userType === 'doctor' ? (
              <>
                <div>
                  <div className="text-2xl font-bold text-white">24/7</div>
                  <div>Доступ</div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div>
                  <div className="text-2xl font-bold text-white">30 мин</div>
                  <div>Слоты</div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div>
                  <div className="text-2xl font-bold text-white">HD</div>
                  <div>Качество</div>
                </div>
              </>
            ) : (
              <>
            <div>
              <div className="text-2xl font-bold text-white">500+</div>
              <div>Врачей</div>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div>
              <div className="text-2xl font-bold text-white">50K+</div>
              <div>Консультаций</div>
            </div>
            <div className="w-px h-12 bg-white/20" />
            <div>
              <div className="text-2xl font-bold text-white">4.9</div>
              <div>Рейтинг</div>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
