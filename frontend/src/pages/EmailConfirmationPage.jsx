import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Button from '../components/ui/Button'
import { authAPI } from '../services/api'
import useAuthStore from '../stores/authStore'

function EmailConfirmationPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const didConfirmRef = useRef(false)

  const [status, setStatus] = useState('loading') // loading | success | error
  const [error, setError] = useState('')

  useEffect(() => {
    if (didConfirmRef.current) return
    didConfirmRef.current = true

    const token = searchParams.get('confirmation')
    if (!token) {
      setStatus('error')
      setError(t('auth_flow.confirm_no_token'))
      return
    }

    authAPI.confirmEmail(token)
      .then((res) => {
        const { jwt, user } = res.data
        if (jwt && user) {
          useAuthStore.setState({
            user,
            token: jwt,
            isAuthenticated: true,
          })
          setStatus('success')
          setTimeout(() => {
            const role = user?.userRole
            if (role === 'doctor') navigate('/doctor', { replace: true })
            else if (role === 'admin') navigate('/admin', { replace: true })
            else navigate('/patient', { replace: true })
          }, 2500)
        } else {
          setStatus('success')
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.error?.message || t('auth_flow.confirm_error')
        setError(msg)
        setStatus('error')
      })
  }, [navigate, searchParams, t])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-sky-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-xl">M</span>
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-teal-600 animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              {t('auth_flow.confirm_loading')}
            </h1>
            <p className="text-slate-500 text-sm">{t('auth_flow.confirm_wait')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              {t('auth_flow.confirm_success_title')}
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              {t('auth_flow.confirm_success_desc')}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('auth_flow.confirm_redirecting')}
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-9 h-9 text-rose-500" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              {t('auth_flow.confirm_error_title')}
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              {error || t('auth_flow.confirm_error')}
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/login">
                <Button className="w-full">{t('auth_flow.go_to_login')}</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default EmailConfirmationPage
