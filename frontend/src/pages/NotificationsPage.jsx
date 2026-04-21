import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Calendar,
  MessageCircle,
  FileText,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  Loader2,
  Video,
} from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import Button from '../components/ui/Button'
import useNotificationStore from '../stores/notificationStore'
import { formatTimeAgo } from '../utils/helpers'

const notificationIcons = {
  appointment: Calendar,
  reminder: Clock,
  message: MessageCircle,
  document: FileText,
  video: Video,
  system: Bell,
}

const notificationColors = {
  appointment: 'bg-teal-100 text-teal-600',
  reminder: 'bg-amber-100 text-amber-600',
  message: 'bg-blue-100 text-blue-600',
  document: 'bg-purple-100 text-purple-600',
  video: 'bg-emerald-100 text-emerald-600',
  system: 'bg-slate-100 text-slate-600',
}

function NotificationsPage() {
  const navigate = useNavigate()
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const isLoading = useNotificationStore((s) => s.isLoading)
  const hasFetchedOnce = useNotificationStore((s) => s.hasFetchedOnce)
  const fetch = useNotificationStore((s) => s.fetch)
  const markAsRead = useNotificationStore((s) => s.markAsRead)
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead)
  const remove = useNotificationStore((s) => s.remove)

  const [filter, setFilter] = useState('all')

  useEffect(() => {
    // Ensure fresh list on page open even if poll is running
    fetch({ silent: hasFetchedOnce })
  }, [fetch, hasFetchedOnce])

  const filtered = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.isRead) : notifications),
    [filter, notifications],
  )

  const handleClick = (n) => {
    const docId = n.documentId || n.id
    if (!n.isRead && docId) markAsRead(docId)
    if (n.link) navigate(n.link)
  }

  if (isLoading && !hasFetchedOnce) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Уведомления</h1>
          <p className="text-slate-600">
            {unreadCount > 0
              ? `У вас ${unreadCount} непрочитанных уведомлений`
              : notifications.length > 0
                ? 'Все уведомления прочитаны'
                : 'Нет новых уведомлений'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button variant="secondary" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Прочитать все
            </Button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Все ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Непрочитанные ({unreadCount})
        </button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bell className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">Нет уведомлений</h3>
            <p className="text-slate-600">
              {filter === 'unread'
                ? 'Все уведомления прочитаны'
                : 'Здесь появятся ваши уведомления'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const Icon = notificationIcons[n.type] || Bell
            const colorClass = notificationColors[n.type] || 'bg-slate-100 text-slate-600'
            const docId = n.documentId || n.id

            return (
              <Card
                key={docId}
                hover
                className={`cursor-pointer ${!n.isRead ? 'border-l-4 border-l-teal-500' : ''}`}
                onClick={() => handleClick(n)}
              >
                <CardContent>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium ${!n.isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                          {n.title}
                        </h3>
                        {!n.isRead && (
                          <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                        )}
                      </div>
                      {n.message && <p className="text-slate-600">{n.message}</p>}
                      <p className="text-sm text-slate-400 mt-1">
                        {formatTimeAgo(n.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!n.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(docId)
                          }}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                          title="Отметить как прочитанное"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(docId)
                        }}
                        className="p-2 hover:bg-red-100 rounded-lg text-slate-500 hover:text-red-600"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NotificationsPage
