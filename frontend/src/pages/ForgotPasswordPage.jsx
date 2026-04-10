import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { Card, CardContent } from '../components/ui/Card'
import api from '../services/api'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSent, setIsSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef(null)

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }
  }, [])

  const startCooldown = () => {
    setResendCooldown(60)
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Введите email')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await api.post('/api/auth/forgot-password', { email })
      setIsSent(true)
      startCooldown()
    } catch (err) {
      const message = err.response?.data?.error?.message || 'Ошибка отправки. Попробуйте позже.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-teal-50 to-cyan-50">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к входу
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Восстановление пароля
          </h1>
          <p className="text-slate-600">
            Введите email, указанный при регистрации. Мы отправим ссылку для сброса пароля.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            {isSent ? (
              <div className="text-center py-4">
                <CheckCircle className="w-16 h-16 text-teal-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Проверьте почту
                </h2>
                <p className="text-slate-600 mb-6">
                  Если аккаунт с адресом <strong>{email}</strong> существует, мы отправили ссылку для сброса пароля.
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  Не получили письмо? Проверьте папку «Спам» или убедитесь, что вы ввели правильный email.
                </p>
                <Button
                  variant="outline"
                  onClick={() => { setIsSent(false); setEmail('') }}
                  className="w-full"
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Повторить через ${resendCooldown} сек` : 'Отправить повторно'}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  error={error}
                  leftIcon={<Mail className="w-5 h-5" />}
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
                  Отправить ссылку
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center mt-6 text-slate-600">
          Вспомнили пароль?{' '}
          <Link
            to="/login"
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
