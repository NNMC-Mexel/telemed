import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Eye, EyeOff, Mail, Lock, User, Phone, CreditCard, Activity, 
  ArrowLeft, CheckCircle, Stethoscope, UserCircle, GraduationCap,
  Building2, FileText
} from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import useAuthStore from '../stores/authStore'
import { isValidEmail, isValidPhone, isValidIIN } from '../utils/helpers'
import { specializationsAPI, normalizeResponse } from '../services/api'

function RegisterPage() {
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuthStore()

  const [userType, setUserType] = useState(null) // null, 'patient', 'doctor'
  const [step, setStep] = useState(1)
  const [specializations, setSpecializations] = useState([])
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    iin: '',
    password: '',
    confirmPassword: '',
    // Doctor specific
    specialization: '',
    licenseNumber: '',
    experience: '',
    education: '',
    workplace: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // Загружаем специализации для врачей
  useEffect(() => {
    const fetchSpecializations = async () => {
      try {
        const response = await specializationsAPI.getAll()
        const { data } = normalizeResponse(response)
        setSpecializations(data || [])
      } catch (err) {
        console.error('Error fetching specializations:', err)
      }
    }
    fetchSpecializations()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }))
    }
    if (error) clearError()
  }

  const validateStep1 = () => {
    const errors = {}
    if (!formData.fullName || formData.fullName.length < 3) {
      errors.fullName = 'Введите ФИО (минимум 3 символа)'
    }
    if (!formData.email || !isValidEmail(formData.email)) {
      errors.email = 'Введите корректный email'
    }
    if (!formData.phone || !isValidPhone(formData.phone)) {
      errors.phone = 'Введите корректный номер телефона'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep2 = () => {
    const errors = {}
    if (!formData.iin || !isValidIIN(formData.iin)) {
      errors.iin = 'ИИН должен содержать 12 цифр'
    }
    if (!formData.password || formData.password.length < 6) {
      errors.password = 'Пароль должен быть минимум 6 символов'
    }
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают'
    }
    if (!agreedToTerms) {
      errors.terms = 'Необходимо принять условия'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateDoctorStep = () => {
    const errors = {}
    if (!formData.specialization) {
      errors.specialization = 'Выберите специализацию'
    }
    if (!formData.licenseNumber) {
      errors.licenseNumber = 'Введите номер лицензии'
    }
    if (!formData.experience || formData.experience < 0) {
      errors.experience = 'Укажите стаж работы'
    }
    if (!formData.education) {
      errors.education = 'Укажите образование'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      if (userType === 'doctor') {
        setStep(2)
      } else {
        setStep(3)
      }
    } else if (step === 2 && validateDoctorStep()) {
      setStep(3)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateStep2()) return

    const userData = {
      username: formData.email,
      email: formData.email,
      password: formData.password,
      fullName: formData.fullName,
      phone: formData.phone,
      iin: formData.iin,
      userRole: userType,
    }

    // Для врачей добавляем дополнительные данные
    if (userType === 'doctor') {
      userData.doctorData = {
        specialization: formData.specialization,
        licenseNumber: formData.licenseNumber,
        experience: parseInt(formData.experience),
        education: formData.education,
        workplace: formData.workplace,
      }
    }

    const result = await register(userData)

    if (result.success) {
      navigate(userType === 'doctor' ? '/doctor' : '/patient')
    }
  }

  const patientBenefits = [
    'Онлайн-консультации с врачами',
    'Электронные рецепты и документы',
    'История приёмов в одном месте',
    'Безопасное хранение данных',
  ]

  const doctorBenefits = [
    'Ведение приёмов онлайн',
    'Гибкий график работы',
    'Расширение клиентской базы',
    'Удобные инструменты для работы',
  ]

  // Выбор типа пользователя
  if (!userType) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 p-4">
        <div className="w-full max-w-2xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Регистрация</h1>
            <p className="text-slate-600">Выберите тип аккаунта</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Patient Card */}
            <button
              onClick={() => setUserType('patient')}
              className="text-left p-6 bg-white rounded-2xl border-2 border-slate-200 hover:border-teal-500 hover:shadow-lg transition-all group"
            >
              <div className="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-teal-500 transition-colors">
                <UserCircle className="w-8 h-8 text-teal-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Пациент</h3>
              <p className="text-slate-600 mb-4">
                Запись к врачам, онлайн-консультации, хранение медицинских документов
              </p>
              <ul className="space-y-2">
                {patientBenefits.slice(0, 3).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-teal-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </button>

            {/* Doctor Card */}
            <button
              onClick={() => setUserType('doctor')}
              className="text-left p-6 bg-white rounded-2xl border-2 border-slate-200 hover:border-teal-500 hover:shadow-lg transition-all group"
            >
              <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-sky-500 transition-colors">
                <Stethoscope className="w-8 h-8 text-sky-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Врач</h3>
              <p className="text-slate-600 mb-4">
                Ведение онлайн-приёмов, управление расписанием, работа с пациентами
              </p>
              <ul className="space-y-2">
                {doctorBenefits.slice(0, 3).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckCircle className="w-4 h-4 text-sky-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </button>
          </div>

          <p className="text-center mt-8 text-slate-600">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-teal-600 hover:text-teal-700 font-medium">
              Войти
            </Link>
          </p>
        </div>
      </div>
    )
  }

  const totalSteps = userType === 'doctor' ? 3 : 2
  const benefits = userType === 'doctor' ? doctorBenefits : patientBenefits
  const accentColor = userType === 'doctor' ? 'sky' : 'teal'

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button
            onClick={() => userType ? setUserType(null) : navigate('/')}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {step > 1 ? 'Назад' : 'Выбор типа аккаунта'}
          </button>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              {userType === 'doctor' ? (
                <Stethoscope className="w-8 h-8 text-sky-600" />
              ) : (
                <UserCircle className="w-8 h-8 text-teal-600" />
              )}
              <h1 className="text-3xl font-bold text-slate-900">
                Регистрация {userType === 'doctor' ? 'врача' : 'пациента'}
              </h1>
            </div>
            <p className="text-slate-600">
              {userType === 'doctor' 
                ? 'Заполните данные для создания профиля врача'
                : 'Создайте аккаунт для записи к врачам'}
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mb-8">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > i + 1 ? `bg-${accentColor}-600 text-white` :
                  step === i + 1 ? `bg-${accentColor}-600 text-white` : 'bg-slate-100 text-slate-400'
                }`}>
                  {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
                </div>
                {i < totalSteps - 1 && (
                  <div className={`flex-1 h-1 rounded ${step > i + 1 ? `bg-${accentColor}-600` : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Step 1: Contact Info */}
                {step === 1 && (
                  <>
                    <Input
                      label="ФИО"
                      name="fullName"
                      type="text"
                      placeholder="Иванов Иван Иванович"
                      value={formData.fullName}
                      onChange={handleChange}
                      error={formErrors.fullName}
                      leftIcon={<User className="w-5 h-5" />}
                      required
                    />

                    <Input
                      label="Email"
                      name="email"
                      type="email"
                      placeholder="example@mail.com"
                      value={formData.email}
                      onChange={handleChange}
                      error={formErrors.email}
                      leftIcon={<Mail className="w-5 h-5" />}
                      required
                    />

                    <Input
                      label="Телефон"
                      name="phone"
                      type="tel"
                      placeholder="+7 (___) ___-__-__"
                      value={formData.phone}
                      onChange={handleChange}
                      error={formErrors.phone}
                      leftIcon={<Phone className="w-5 h-5" />}
                      required
                    />

                    <Button type="button" className="w-full" size="lg" onClick={handleNextStep}>
                      Продолжить
                    </Button>
                  </>
                )}

                {/* Step 2: Doctor Info (only for doctors) */}
                {step === 2 && userType === 'doctor' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Специализация *
                      </label>
                      <select
                        name="specialization"
                        value={formData.specialization}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                          formErrors.specialization ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      >
                        <option value="">Выберите специализацию</option>
                        {specializations.map(spec => (
                          <option key={spec.id} value={spec.id}>{spec.name}</option>
                        ))}
                      </select>
                      {formErrors.specialization && (
                        <p className="mt-1 text-sm text-rose-600">{formErrors.specialization}</p>
                      )}
                    </div>

                    <Input
                      label="Номер лицензии"
                      name="licenseNumber"
                      type="text"
                      placeholder="Введите номер лицензии"
                      value={formData.licenseNumber}
                      onChange={handleChange}
                      error={formErrors.licenseNumber}
                      leftIcon={<FileText className="w-5 h-5" />}
                      required
                    />

                    <Input
                      label="Стаж работы (лет)"
                      name="experience"
                      type="number"
                      min="0"
                      placeholder="5"
                      value={formData.experience}
                      onChange={handleChange}
                      error={formErrors.experience}
                      required
                    />

                    <Input
                      label="Образование"
                      name="education"
                      type="text"
                      placeholder="Университет, год окончания"
                      value={formData.education}
                      onChange={handleChange}
                      error={formErrors.education}
                      leftIcon={<GraduationCap className="w-5 h-5" />}
                      required
                    />

                    <Input
                      label="Место работы (необязательно)"
                      name="workplace"
                      type="text"
                      placeholder="Название клиники"
                      value={formData.workplace}
                      onChange={handleChange}
                      leftIcon={<Building2 className="w-5 h-5" />}
                    />

                    <div className="flex gap-3">
                      <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                        Назад
                      </Button>
                      <Button type="button" className="flex-1" onClick={handleNextStep}>
                        Продолжить
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 3 (or 2 for patient): Security */}
                {((step === 3 && userType === 'doctor') || (step === 2 && userType === 'patient') || step === 3) && step !== 2 && (
                  <>
                    <Input
                      label="ИИН"
                      name="iin"
                      type="text"
                      placeholder="____________"
                      maxLength={12}
                      value={formData.iin}
                      onChange={handleChange}
                      error={formErrors.iin}
                      leftIcon={<CreditCard className="w-5 h-5" />}
                      hint="12 цифр, указанных в документе"
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
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      }
                      required
                    />

                    <Input
                      label="Подтвердите пароль"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      error={formErrors.confirmPassword}
                      leftIcon={<Lock className="w-5 h-5" />}
                      required
                    />

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className={`w-4 h-4 mt-1 rounded border-slate-300 text-${accentColor}-600 focus:ring-${accentColor}-500`}
                      />
                      <span className="text-sm text-slate-600">
                        Я согласен с{' '}
                        <Link to="/terms" className={`text-${accentColor}-600 hover:underline`}>
                          условиями использования
                        </Link>{' '}
                        и{' '}
                        <Link to="/privacy" className={`text-${accentColor}-600 hover:underline`}>
                          политикой конфиденциальности
                        </Link>
                      </span>
                    </label>
                    {formErrors.terms && <p className="text-sm text-rose-600">{formErrors.terms}</p>}

                    {error && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
                        {error}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        className="flex-1"
                        size="lg"
                        onClick={() => setStep(userType === 'doctor' ? 2 : 1)}
                      >
                        Назад
                      </Button>
                      <Button type="submit" className="flex-1" size="lg" isLoading={isLoading}>
                        Зарегистрироваться
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          <p className="text-center mt-6 text-slate-600">
            Уже есть аккаунт?{' '}
            <Link to="/login" className={`text-${accentColor}-600 hover:text-${accentColor}-700 font-medium`}>
              Войти
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Decoration */}
      <div className={`hidden lg:flex flex-1 bg-gradient-to-br ${
        userType === 'doctor' 
          ? 'from-sky-600 via-sky-700 to-indigo-800' 
          : 'from-teal-600 via-teal-700 to-sky-800'
      } items-center justify-center p-12 relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-sky-300 rounded-full blur-3xl" />
        </div>

        <div className="relative text-white max-w-md">
          <div className="w-20 h-20 mb-8 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur">
            {userType === 'doctor' ? (
              <Stethoscope className="w-10 h-10 text-white" />
            ) : (
              <Activity className="w-10 h-10 text-white" />
            )}
          </div>
          <h2 className="text-3xl font-bold mb-4">
            {userType === 'doctor' 
              ? 'Станьте частью MedConnect'
              : 'Присоединяйтесь к MedConnect'}
          </h2>
          <p className="text-xl text-white/80 mb-8">
            {userType === 'doctor'
              ? 'Помогайте пациентам онлайн и развивайте свою практику'
              : 'Регистрация откроет вам доступ к лучшим врачам Казахстана'}
          </p>
          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-3">
                <CheckCircle className={`w-6 h-6 ${userType === 'doctor' ? 'text-sky-300' : 'text-teal-300'} flex-shrink-0`} />
                <span className="text-white/90">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
