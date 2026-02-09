import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, Search, Menu, X, Loader2 } from 'lucide-react'
import { cn } from '../../utils/helpers'
import Avatar from '../ui/Avatar'
import useAuthStore from '../../stores/authStore'
import { getMediaUrl, notificationsAPI, normalizeResponse } from '../../services/api'

function Header({ title, subtitle, onMenuClick, isMobileMenuOpen }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  // Загрузка уведомлений из API
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.id) return
      
      setIsLoading(true)
      try {
        const response = await notificationsAPI.getAll(user.id)
        const { data } = normalizeResponse(response)
        setNotifications(data || [])
      } catch (error) {
        console.error('Error fetching notifications:', error)
        // Если API уведомлений не существует - показываем пустой список
        setNotifications([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchNotifications()
  }, [user?.id])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  // Определяем базовый путь для уведомлений
  const getNotificationsPath = () => {
    if (location.pathname.startsWith('/doctor')) return '/doctor/notifications'
    if (location.pathname.startsWith('/admin')) return '/admin/notifications'
    return '/patient/notifications'
  }

  const handleShowAll = () => {
    setShowNotifications(false)
    navigate(getNotificationsPath())
  }

  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes} мин назад`
    if (hours < 24) return `${hours} ч назад`
    return `${days} дн назад`
  }

  return (
    <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 pt-[var(--safe-top)]">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        {/* Left Side */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* Mobile Menu Button */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Title */}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{title}</h1>
            {subtitle && <p className="hidden sm:block text-sm text-slate-500 truncate">{subtitle}</p>}
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Search */}
          <div className={cn(
            'transition-all duration-300',
            showSearch ? 'w-[min(52vw,220px)] sm:w-64' : 'w-auto'
          )}>
            {showSearch ? (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  autoFocus
                  onBlur={() => setShowSearch(false)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            ) : (
              <button
                onClick={() => setShowSearch(true)}
                className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-xs font-medium flex items-center justify-center rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-slideDown">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-900">Уведомления</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-500">
                        <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">Нет уведомлений</p>
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notification) => (
                        <div
                          key={notification.id}
                          className={cn(
                            'p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors',
                            !notification.isRead && 'bg-teal-50/50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {!notification.isRead && (
                              <span className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">
                                {notification.title}
                              </p>
                              <p className="text-sm text-slate-600 truncate">
                                {notification.message}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {formatTime(notification.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 bg-slate-50">
                    <button 
                      onClick={handleShowAll}
                      className="w-full text-sm text-teal-600 hover:text-teal-700 font-medium py-2 px-4 bg-white rounded-xl border border-slate-200 hover:border-teal-300 transition-colors"
                    >
                      Показать все
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* User */}
          <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-slate-200">
            <Avatar
              src={getMediaUrl(user?.avatar)}
              name={user?.fullName || user?.username}
              size="sm"
              status="online"
            />
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-slate-900">
                {user?.fullName || user?.username}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
