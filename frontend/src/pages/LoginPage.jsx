import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Mail, Lock, Activity, ArrowLeft, Stethoscope, UserCircle, Send, CheckCircle } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import useAuthStore from '../stores/authStore'
import { authAPI } from '../services/api'
import { isNativeMobileApp } from '../utils/platform'

function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, isLoading, error, clearError } = useAuthStore()
  const isNativeApp = isNativeMobileApp()
  const [resendStatus, setResendStatus] = useState(null) // null | 'sending' | 'sent' | 'error'

  const isUnconfirmedError = error === 'email_not_confirmed' || error?.includes('email_not_confirmed')

  const handleResend = async () => {
    if (resendStatus === 'sending') return
    setResendStatus('sending')
    try {
      await authAPI.resendConfirmation(formData.identifier)
      setResendStatus('sent')
    } catch {
      setResendStatus('error')
    }
  }

  const initialUserType = searchParams.get('type') || 'patient'
  const [userType, setUserType] = useState(initialUserType)

  const [formData, setFormData] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [formErrors, setFormErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: null }))
    if (error) clearError()
  }

  const validate = () => {
    const errors = {}
    if (!formData.identifier) errors.identifier = t('auth.login.error_identifier')
    if (!formData.password) errors.password = t('auth.login.error_password')
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
      if (role === 'admin') navigate('/admin')
      else if (role === 'doctor') navigate('/doctor')
      else navigate('/patient')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {!isNativeApp && (
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('auth.login.back_home')}
            </Link>
          )}

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">{t('auth.login.title')}</h1>
            <p className="text-slate-600">{t('auth.login.subtitle')}</p>
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
              {t('auth.login.patient_tab')}
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
              {t('auth.login.doctor_tab')}
            </button>
          </div>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label={t('auth.login.email_phone')}
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
                  label={t('auth.login.password')}
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

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-600">{t('auth.login.remember_me')}</span>
                  </label>
                  <Link to="/forgot-password" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
                    {t('auth.login.forgot_password')}
                  </Link>
                </div>

                {error && !isUnconfirmedError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-600">
                    {error}
                  </div>
                )}

                {isUnconfirmedError && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-800 font-medium mb-1">
                      {t('auth_flow.login_unconfirmed_title')}
                    </p>
                    <p className="text-xs text-amber-700 mb-3">
                      {t('auth_flow.login_unconfirmed_desc')}
                    </p>
                    {resendStatus === 'sent' ? (
                      <div className="flex items-center gap-2 text-emerald-700 text-xs font-medium">
                        <CheckCircle className="w-4 h-4" />
                        {t('auth_flow.resend_success')}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendStatus === 'sending'}
                        className="flex items-center gap-1.5 text-xs font-medium text-amber-800 hover:text-amber-900 underline underline-offset-2"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {resendStatus === 'sending' ? t('auth_flow.resend_sending') : t('auth_flow.resend_btn')}
                      </button>
                    )}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
                  {t('auth.login.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center mt-6 text-slate-600">
            {t('auth.login.no_account')}{' '}
            <Link to="/register" className="text-teal-600 hover:text-teal-700 font-medium">
              {t('auth.login.register_link')}
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
            {userType === 'doctor' ? t('auth.login.doctor_title') : 'MedConnect'}
          </h2>
          <p className="text-xl text-white/80 mb-8">
            {userType === 'doctor' ? t('auth.login.doctor_desc') : t('auth.login.platform_desc')}
          </p>
          <div className="flex items-center justify-center gap-8 text-white/60 text-sm">
            {userType === 'doctor' ? (
              <>
                <div>
                  <div className="text-2xl font-bold text-white">24/7</div>
                  <div>{t('auth.login.stats_access')}</div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div>
                  <div className="text-2xl font-bold text-white">30 {t('common.year_1')}</div>
                  <div>{t('auth.login.stats_slots')}</div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div>
                  <div className="text-2xl font-bold text-white">HD</div>
                  <div>{t('auth.login.stats_quality')}</div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-2xl font-bold text-white">500+</div>
                  <div>{t('auth.login.stats_doctors')}</div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div>
                  <div className="text-2xl font-bold text-white">50K+</div>
                  <div>{t('auth.login.stats_consultations')}</div>
                </div>
                <div className="w-px h-12 bg-white/20" />
                <div>
                  <div className="text-2xl font-bold text-white">4.9</div>
                  <div>{t('auth.login.stats_rating')}</div>
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
