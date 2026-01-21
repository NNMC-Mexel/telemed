import { useState, useEffect } from 'react'
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
import useAuthStore from '../stores/authStore'
import api, { normalizeResponse, notificationsAPI } from '../services/api'
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
  const { user } = useAuthStore()
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (user?.id) {
      fetchNotifications()
    }
  }, [user?.id])

  const fetchNotifications = async () => {
    setIsLoading(true)
    try {
      const notificationsList = []

      // Пробуем загрузить из API уведомлений
      try {
        const notifRes = await notificationsAPI.getAll(user.id)
        const { data: apiNotifications } = normalizeResponse(notifRes)
        
        apiNotifications?.forEach(notif => {
          notificationsList.push({
            id: `notif-${notif.id}`,
            strapiId: notif.id,
            type: notif.type || 'system',
            title: notif.title,
            message: notif.message,
            time: new Date(notif.createdAt),
            isRead: notif.isRead || false,
            link: notif.link,
          })
        })
      } catch (e) {
        console.log('Notifications API not available')
      }

      // Предстоящие записи
      try {
        const appointmentsRes = await api.get(
          `/api/appointments?filters[$or][0][patient][id][$eq]=${user.id}&filters[$or][1][doctor][id][$eq]=${user.id}&filters[status][$in][0]=pending&filters[status][$in][1]=confirmed&populate=*&sort=dateTime:asc&pagination[limit]=10`
        )
        const { data: appointments } = normalizeResponse(appointmentsRes)
        
        appointments?.forEach(apt => {
          const aptDate = new Date(apt.dateTime)
          const now = new Date()
          const diffHours = (aptDate - now) / (1000 * 60 * 60)
          
          if (diffHours > 0 && diffHours <= 48) {
            const isDoctor = apt.doctor?.user?.id === user.id
            const otherParty = isDoctor 
              ? apt.patient?.fullName || 'Пациент'
              : apt.doctor?.fullName || 'Врач'
            
            notificationsList.push({
              id: `apt-${apt.id}`,
              type: diffHours <= 1 ? 'video' : 'reminder',
              title: diffHours <= 1 ? 'Консультация скоро начнётся' : 'Напоминание о записи',
              message: `${isDoctor ? 'Приём с пациентом' : 'Консультация с врачом'}: ${otherParty}`,
              time: new Date(apt.updatedAt || apt.createdAt),
              isRead: false,
              link: apt.roomId ? `/consultation/${apt.roomId}` : null,
            })
          }
        })
      } catch (e) {
        console.error('Error fetching appointments:', e)
      }

      notificationsList.sort((a, b) => b.time - a.time)
      setNotifications(notificationsList)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead
    return true
  })

  const markAsRead = async (id) => {
    const notif = notifications.find(n => n.id === id)
    if (notif?.strapiId) {
      try {
        await notificationsAPI.markAsRead(notif.strapiId)
      } catch (e) {
        console.log('Could not mark as read in API')
      }
    }
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const clearAll = () => {
    setNotifications([])
  }

  if (isLoading) {
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
          {notifications.length > 0 && (
            <Button variant="secondary" onClick={clearAll}>
              <Trash2 className="w-4 h-4 mr-2" />
              Очистить
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

      {filteredNotifications.length === 0 ? (
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
          {filteredNotifications.map((notification) => {
            const Icon = notificationIcons[notification.type] || Bell
            const colorClass = notificationColors[notification.type] || 'bg-slate-100 text-slate-600'
            
            const content = (
              <Card 
                key={notification.id} 
                hover 
                className={`cursor-pointer ${!notification.isRead ? 'border-l-4 border-l-teal-500' : ''}`}
                onClick={() => markAsRead(notification.id)}
              >
                <CardContent>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-medium ${!notification.isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                          {notification.title}
                        </h3>
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                        )}
                      </div>
                      <p className="text-slate-600">{notification.message}</p>
                      <p className="text-sm text-slate-400 mt-1">
                        {formatTimeAgo(notification.time)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.isRead && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            markAsRead(notification.id)
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
                          deleteNotification(notification.id)
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

            if (notification.link) {
              return (
                <a key={notification.id} href={notification.link}>
                  {content}
                </a>
              )
            }
            return content
          })}
        </div>
      )}
    </div>
  )
}

export default NotificationsPage
