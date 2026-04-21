import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, Search, Menu, X, Loader2, CheckCheck } from 'lucide-react'
import { cn } from '../../utils/helpers'
import Avatar from '../ui/Avatar'
import useAuthStore from '../../stores/authStore'
import useNotificationStore from '../../stores/notificationStore'
import { getMediaUrl } from '../../services/api'

function Header({ title, subtitle, onMenuClick, isMobileMenuOpen }) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showSearch, setShowSearch] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const isLoading = useNotificationStore((s) => s.isLoading)
  const startPolling = useNotificationStore((s) => s.startPolling)
  const stopPolling = useNotificationStore((s) => s.stopPolling)
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)

  useEffect(() => {
    if (!user?.id) {
      stopPolling()
      return
    }
    startPolling()
    return () => stopPolling()
  }, [user?.id, startPolling, stopPolling])

  const getNotificationsPath = () => {
    if (location.pathname.startsWith('/doctor')) return '/doctor/notifications'
    if (location.pathname.startsWith('/admin')) return '/admin/notifications'
    return '/patient/notifications'
  }

  const handleShowAll = () => {
    setShowNotifications(false)
    navigate(getNotificationsPath())
  }

  const handleNotificationClick = (notification) => {
    const docId = notification.documentId || notification.id
    if (!notification.isRead && docId) markAsRead(docId)
    setShowNotifications(false)
    if (notification.link) navigate(notification.link)
  }

  const handleMarkAllRead = (e) => {
    e.stopPropagation()
    markAllAsRead()
  }

  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return 'только что'
    if (minutes < 60) return `${minutes} мин назад`
    if (hours < 24) return `${hours} ч назад`
    return `${days} дн назад`
  }

  const badgeText = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-30 pt-[var(--safe-top)]">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-semibold text-slate-900 truncate">{title}</h1>
            {subtitle && <p className="hidden sm:block text-sm text-slate-500 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
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

          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Bell
                key={unreadCount}
                className={cn('w-5 h-5', unreadCount > 0 && 'animate-wiggle')}
              />
              {unreadCount > 0 && (
                <span
                  className={cn(
                    'absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center rounded-full ring-2 ring-white',
                  )}
                >
                  {badgeText}
                </span>
              )}
            </button>

            {showNotifications && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-slideDown">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-slate-900">Уведомления</h3>
                      {unreadCount > 0 && (
                        <p className="text-xs text-slate-500">{unreadCount} непрочитанных</p>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Прочитать все
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {isLoading && notifications.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-500">
                        <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                        <p className="text-sm">Нет уведомлений</p>
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <button
                          key={n.documentId || n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            'w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors',
                            !n.isRead && 'bg-teal-50/50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {!n.isRead && (
                              <span className="w-2 h-2 bg-teal-500 rounded-full mt-2 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                'text-sm font-medium',
                                n.isRead ? 'text-slate-700' : 'text-slate-900'
                              )}>
                                {n.title}
                              </p>
                              {n.message && (
                                <p className="text-sm text-slate-600 truncate">
                                  {n.message}
                                </p>
                              )}
                              <p className="text-xs text-slate-400 mt-1">
                                {formatTime(n.createdAt)}
                              </p>
                            </div>
                          </div>
                        </button>
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
