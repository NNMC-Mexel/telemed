import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Lock, ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import api from '../services/api'
import { getPasswordError } from '../utils/helpers'

function ResetPasswordPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const code = searchParams.get('code')

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isReset, setIsReset] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    const passwordErrorKey = getPasswordError(password)
    if (passwordErrorKey) {
      setError(t(passwordErrorKey))
      return
    }
    if (password !== passwordConfirmation) {
      setError(t('auth_flow.reset_mismatch'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await api.post('/api/auth/reset-password', {
        code,
        password,
        passwordConfirmation,
      })
      setIsReset(true)
    } catch (err) {
      const message = err.response?.data?.error?.message || t('auth_flow.reset_error')
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-teal-50 to-cyan-50">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">
            {t('auth_flow.reset_invalid_title')}
          </h1>
          <p className="text-slate-600 mb-6">
            {t('auth_flow.reset_invalid_desc')}
          </p>
          <Link to="/forgot-password">
            <Button className="w-full">{t('auth_flow.reset_request_new')}</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-teal-50 to-cyan-50">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('auth_flow.forgot_back')}
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {t('auth_flow.reset_title')}
          </h1>
          <p className="text-slate-600">
            {t('auth_flow.reset_subtitle')}
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {isReset ? (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-teal-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  {t('auth_flow.reset_done_title')}
                </h2>
                <p className="text-slate-600 mb-6">
                  {t('auth_flow.reset_done_desc')}
                </p>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  {t('auth_flow.reset_login')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label={t('auth_flow.reset_new_password')}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth_flow.reset_min_chars')}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
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
                  label={t('auth_flow.reset_confirm')}
                  name="passwordConfirmation"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth_flow.reset_repeat')}
                  value={passwordConfirmation}
                  onChange={(e) => { setPasswordConfirmation(e.target.value); setError(null) }}
                  leftIcon={<Lock className="w-5 h-5" />}
                  required
                />

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
                  {t('auth_flow.reset_save')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ResetPasswordPage
