import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Eye, EyeOff, Mail, Lock, User, Phone, CreditCard, Activity,
  ArrowLeft, CheckCircle, Stethoscope, UserCircle, GraduationCap,
  Building2, FileText, Send
} from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import { Card, CardContent } from '../components/ui/Card'
import useAuthStore from '../stores/authStore'
import { formatKazakhstanPhoneInput, isValidEmail, isValidPhone, isValidIIN, getPasswordError } from '../utils/helpers'
import { specializationsAPI, normalizeResponse, authAPI } from '../services/api'

const REQUIRED_CONSENTS = [
  'personalData',
  'medicalData',
  'telemedicine',
  'thirdPartyTransfer',
  'termsAndPrivacy',
]

function RegisterPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuthStore()

  const [userType] = useState('patient')
  const [step, setStep] = useState(1)
  const [pendingEmail, setPendingEmail] = useState(null)
  const [resendStatus, setResendStatus] = useState(null) // null | 'sending' | 'sent' | 'error'
  const [specializations, setSpecializations] = useState([])
  const [formData, setFormData] = useState({
    fullName: '', email: '', phone: '', iin: '',
    password: '', confirmPassword: '',
    specialization: '', licenseNumber: '', experience: '',
    education: '', workplace: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [consents, setConsents] = useState({
    personalData: false,
    medicalData: false,
    telemedicine: false,
    thirdPartyTransfer: false,
    termsAndPrivacy: false,
  })

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
    const nextValue = name === 'phone' ? formatKazakhstanPhoneInput(value, true) : value
    setFormData((prev) => ({ ...prev, [name]: nextValue }))
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }))
    if (error) clearError()
  }

  const validateStep1 = () => {
    const errors = {}
    if (!formData.fullName || formData.fullName.length < 3)
      errors.fullName = t('auth.register.validation.full_name')
    if (!formData.email || !isValidEmail(formData.email))
      errors.email = t('auth.register.validation.email')
    if (!formData.phone || !isValidPhone(formData.phone))
      errors.phone = t('auth.register.validation.phone')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep2 = () => {
    const errors = {}
    if (!formData.iin || !isValidIIN(formData.iin))
      errors.iin = t('auth.register.validation.iin')
    const passwordErrorKey = getPasswordError(formData.password)
    if (passwordErrorKey)
      errors.password = t(passwordErrorKey)
    if (formData.password !== formData.confirmPassword)
      errors.confirmPassword = t('auth.register.validation.confirm_password')
    if (REQUIRED_CONSENTS.some((key) => consents[key] !== true))
      errors.consents = t('auth.register.validation.consents')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleConsentChange = (name, checked) => {
    setConsents((prev) => ({ ...prev, [name]: checked }))
    if (formErrors.consents) setFormErrors((prev) => ({ ...prev, consents: null }))
  }

  const validateDoctorStep = () => {
    const errors = {}
    if (!formData.specialization) errors.specialization = t('auth.register.validation.specialization')
    if (!formData.licenseNumber) errors.licenseNumber = t('auth.register.validation.license')
    if (!formData.experience || formData.experience < 0) errors.experience = t('auth.register.validation.experience')
    if (!formData.education) errors.education = t('auth.register.validation.education')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
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
      consents: {
        ...consents,
        locale: i18n.language || 'ru',
      },
    }

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
      if (result.pendingConfirmation) {
        setPendingEmail(result.email || formData.email)
      } else {
        navigate('/patient')
      }
    }
  }

  const handleResend = async () => {
    if (!pendingEmail || resendStatus === 'sending') return
    setResendStatus('sending')
    try {
      await authAPI.resendConfirmation(pendingEmail)
      setResendStatus('sent')
    } catch {
      setResendStatus('error')
    }
  }

  const patientBenefits = [
    t('auth.register.patient_benefits_0'),
    t('auth.register.patient_benefits_1'),
    t('auth.register.patient_benefits_2'),
    t('auth.register.patient_benefits_3'),
  ]

  const doctorBenefits = [
    t('auth.register.doctor_benefits_0'),
    t('auth.register.doctor_benefits_1'),
    t('auth.register.doctor_benefits_2'),
    t('auth.register.doctor_benefits_3'),
  ]

  const totalSteps = userType === 'doctor' ? 3 : 2
  const benefits = userType === 'doctor' ? doctorBenefits : patientBenefits
  const accentColor = userType === 'doctor' ? 'sky' : 'teal'

  // Экран "проверьте почту"
  if (pendingEmail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-sky-50/30 flex items-center justify-center p-4">
        <div className="absolute right-4 top-4">
          <LanguageSwitcher variant="light" />
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            {t('auth_flow.check_email_title')}
          </h1>
          <p className="text-slate-500 text-sm mb-2">
            {t('auth_flow.check_email_desc')}
          </p>
          <p className="font-medium text-slate-800 mb-6">{pendingEmail}</p>
          <p className="text-slate-400 text-xs mb-6">
            {t('auth_flow.check_email_hint')}
          </p>

          {resendStatus === 'sent' ? (
            <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm font-medium mb-4">
              <CheckCircle className="w-4 h-4" />
              {t('auth_flow.resend_success')}
            </div>
          ) : (
            <Button
              variant="secondary"
              className="w-full mb-4"
              onClick={handleResend}
              isLoading={resendStatus === 'sending'}
              leftIcon={<Send className="w-4 h-4" />}
            >
              {t('auth_flow.resend_btn')}
            </Button>
          )}

          {resendStatus === 'error' && (
            <p className="text-rose-500 text-sm mb-4">{t('auth_flow.resend_error')}</p>
          )}

          <Link to="/login" className="text-sm text-teal-600 hover:text-teal-700">
            {t('auth_flow.go_to_login')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {step > 1 ? t('common.back') : t('auth.login.back_home')}
          </button>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              {userType === 'doctor' ? (
                <Stethoscope className="w-8 h-8 text-sky-600" />
              ) : (
                <UserCircle className="w-8 h-8 text-teal-600" />
              )}
              <h1 className="text-3xl font-bold text-slate-900">
                {userType === 'doctor' ? t('auth.register.doctor_registration') : t('auth.register.patient_registration')}
              </h1>
            </div>
            <p className="text-slate-600">
              {userType === 'doctor' ? t('auth.register.doctor_form_desc') : t('auth.register.patient_form_desc')}
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
                      label={t('auth.register.full_name')}
                      name="fullName"
                      type="text"
                      placeholder={t('auth.register.full_name_placeholder')}
                      value={formData.fullName}
                      onChange={handleChange}
                      error={formErrors.fullName}
                      leftIcon={<User className="w-5 h-5" />}
                      required
                    />
                    <Input
                      label={t('auth.register.email')}
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
                      label={t('auth.register.phone')}
                      name="phone"
                      type="tel"
                      placeholder="+7 ___ ___-__-__"
                      value={formData.phone}
                      onChange={handleChange}
                      onFocus={() => {
                        if (!formData.phone) {
                          setFormData((prev) => ({ ...prev, phone: '+7 ' }))
                        }
                      }}
                      error={formErrors.phone}
                      leftIcon={<Phone className="w-5 h-5" />}
                      required
                    />
                    <Button type="button" className="w-full" size="lg" onClick={handleNextStep}>
                      {t('common.continue')}
                    </Button>
                  </>
                )}

                {/* Step 2: Doctor Info */}
                {step === 2 && userType === 'doctor' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t('auth.register.specialization')} *
                      </label>
                      <select
                        name="specialization"
                        value={formData.specialization}
                        onChange={handleChange}
                        className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                          formErrors.specialization ? 'border-rose-500' : 'border-slate-300'
                        }`}
                      >
                        <option value="">{t('auth.register.choose_spec')}</option>
                        {specializations.map(spec => (
                          <option key={spec.id} value={spec.id}>{spec.name}</option>
                        ))}
                      </select>
                      {formErrors.specialization && (
                        <p className="mt-1 text-sm text-rose-600">{formErrors.specialization}</p>
                      )}
                    </div>
                    <Input
                      label={t('auth.register.license_number')}
                      name="licenseNumber"
                      type="text"
                      placeholder={t('auth.register.license_placeholder')}
                      value={formData.licenseNumber}
                      onChange={handleChange}
                      error={formErrors.licenseNumber}
                      leftIcon={<FileText className="w-5 h-5" />}
                      required
                    />
                    <Input
                      label={t('auth.register.experience_years')}
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
                      label={t('auth.register.education')}
                      name="education"
                      type="text"
                      placeholder={t('auth.register.education_placeholder')}
                      value={formData.education}
                      onChange={handleChange}
                      error={formErrors.education}
                      leftIcon={<GraduationCap className="w-5 h-5" />}
                      required
                    />
                    <Input
                      label={t('auth.register.workplace')}
                      name="workplace"
                      type="text"
                      placeholder={t('auth.register.workplace_placeholder')}
                      value={formData.workplace}
                      onChange={handleChange}
                      leftIcon={<Building2 className="w-5 h-5" />}
                    />
                    <div className="flex gap-3">
                      <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                        {t('common.back')}
                      </Button>
                      <Button type="button" className="flex-1" onClick={handleNextStep}>
                        {t('common.continue')}
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 3: Security */}
                {((step === 3 && userType === 'doctor') || (step === 2 && userType === 'patient')) && (
                  <>
                    <Input
                      label={t('auth.register.iin')}
                      name="iin"
                      type="text"
                      placeholder="____________"
                      maxLength={12}
                      value={formData.iin}
                      onChange={handleChange}
                      error={formErrors.iin}
                      leftIcon={<CreditCard className="w-5 h-5" />}
                      hint={t('auth.register.iin_hint')}
                      required
                    />
                    <Input
                      label={t('auth.register.password')}
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
                      label={t('auth.register.confirm_password')}
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      error={formErrors.confirmPassword}
                      leftIcon={<Lock className="w-5 h-5" />}
                      required
                    />
                    <div className="space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consents.personalData}
                          onChange={(e) => handleConsentChange('personalData', e.target.checked)}
                          className={`w-4 h-4 mt-1 rounded border-slate-300 text-${accentColor}-600 focus:ring-${accentColor}-500`}
                        />
                        <span className="text-sm text-slate-600">
                          {t('auth.register.consent_personal_data')}{' '}
                          <Link to="/privacy" className={`text-${accentColor}-600 hover:underline`}>
                            {t('auth.register.privacy')}
                          </Link>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consents.medicalData}
                          onChange={(e) => handleConsentChange('medicalData', e.target.checked)}
                          className={`w-4 h-4 mt-1 rounded border-slate-300 text-${accentColor}-600 focus:ring-${accentColor}-500`}
                        />
                        <span className="text-sm text-slate-600">
                          {t('auth.register.consent_medical_data')}
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consents.telemedicine}
                          onChange={(e) => handleConsentChange('telemedicine', e.target.checked)}
                          className={`w-4 h-4 mt-1 rounded border-slate-300 text-${accentColor}-600 focus:ring-${accentColor}-500`}
                        />
                        <span className="text-sm text-slate-600">
                          {t('auth.register.consent_telemedicine')}
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consents.thirdPartyTransfer}
                          onChange={(e) => handleConsentChange('thirdPartyTransfer', e.target.checked)}
                          className={`w-4 h-4 mt-1 rounded border-slate-300 text-${accentColor}-600 focus:ring-${accentColor}-500`}
                        />
                        <span className="text-sm text-slate-600">
                          {t('auth.register.consent_third_party')}
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={consents.termsAndPrivacy}
                          onChange={(e) => handleConsentChange('termsAndPrivacy', e.target.checked)}
                          className={`w-4 h-4 mt-1 rounded border-slate-300 text-${accentColor}-600 focus:ring-${accentColor}-500`}
                        />
                        <span className="text-sm text-slate-600">
                          {t('auth.register.agree_with')}{' '}
                          <Link to="/terms" className={`text-${accentColor}-600 hover:underline`}>
                            {t('auth.register.terms')}
                          </Link>{' '}
                          {t('common.and')}{' '}
                          <Link to="/privacy" className={`text-${accentColor}-600 hover:underline`}>
                            {t('auth.register.privacy')}
                          </Link>
                        </span>
                      </label>
                    </div>
                    {formErrors.consents && <p className="text-sm text-rose-600">{formErrors.consents}</p>}

                    {error && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
                        {error === 'phone_already_registered'
                          ? t('auth.register.validation.phone_taken')
                          : error === 'iin_already_registered'
                          ? t('auth.register.validation.iin_taken')
                          : (error === 'Email or Username are already taken' || error === 'email_already_taken')
                          ? t('auth.register.validation.email_taken')
                          : error}
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
                        {t('common.back')}
                      </Button>
                      <Button type="submit" className="flex-1" size="lg" isLoading={isLoading}>
                        {t('auth.register.submit')}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </CardContent>
          </Card>

          <p className="text-center mt-6 text-slate-600">
            {t('auth.register.already_account')}{' '}
            <Link to="/login" className={`text-${accentColor}-600 hover:text-${accentColor}-700 font-medium`}>
              {t('auth.register.login_link')}
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
            {userType === 'doctor' ? t('auth.register.doctor_join_title') : t('auth.register.patient_join_title')}
          </h2>
          <p className="text-xl text-white/80 mb-8">
            {userType === 'doctor' ? t('auth.register.doctor_join_desc') : t('auth.register.patient_join_desc')}
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
