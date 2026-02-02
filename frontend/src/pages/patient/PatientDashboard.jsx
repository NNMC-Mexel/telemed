import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  Video,
  FileText,
  ChevronRight,
  TrendingUp,
  Activity,
  Bell,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import useAuthStore from '../../stores/authStore'
import useAppointmentStore from '../../stores/appointmentStore'
import useDocumentStore from '../../stores/documentStore'
import useChatStore from '../../stores/chatStore'
import { formatRelativeDate, formatPrice } from '../../utils/helpers'
import { getMediaUrl } from '../../services/api'

function PatientDashboard() {
  const { user } = useAuthStore()
  const { appointments, fetchAppointments, isLoading: appointmentsLoading } = useAppointmentStore()
  const { documents, fetchDocuments, isLoading: documentsLoading } = useDocumentStore()
  const { conversations, fetchConversations, isLoading: chatsLoading } = useChatStore()
  
  const [stats, setStats] = useState({
    totalConsultations: 0,
    upcomingCount: 0,
    documentsCount: 0,
    unreadMessages: 0,
  })

  useEffect(() => {
    // Загружаем данные пользователя
    if (user?.id) {
      fetchAppointments()
      fetchDocuments({ user: user.id })
      fetchConversations(user.id)
    }
  }, [user?.id])

  // Функция для проверки, прошла ли запись (на основе длительности консультации)
  const isAppointmentPast = (appointment) => {
    const appointmentDate = new Date(appointment.dateTime)
    // Длительность консультации + буфер 5 минут
    const consultationDuration = appointment.doctor?.consultationDuration || 30
    const bufferMinutes = 5
    const consultationEnd = new Date(appointmentDate.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000)
    return new Date() > consultationEnd || appointment.status === 'completed'
  }

  useEffect(() => {
    // Подсчитываем статистику
    const completed = appointments.filter(a =>
      a.status === 'completed' ||
      (['pending', 'confirmed'].includes(a.status) && isAppointmentPast(a))
    ).length
    const upcoming = appointments.filter(a =>
      ['pending', 'confirmed'].includes(a.status) && !isAppointmentPast(a)
    ).length
    const unread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
    
    setStats({
      totalConsultations: completed,
      upcomingCount: upcoming,
      documentsCount: documents.length,
      unreadMessages: unread,
    })
  }, [appointments, documents, conversations])

  const upcomingAppointments = appointments
    .filter(a => ['pending', 'confirmed'].includes(a.status) && !isAppointmentPast(a))
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime))
    .slice(0, 3)

  const recentConversations = conversations.slice(0, 3)

  const quickActions = [
    { label: 'Записаться к врачу', icon: Calendar, to: '/patient/doctors', color: 'bg-teal-500' },
    { label: 'Мои записи', icon: Clock, to: '/patient/appointments', color: 'bg-sky-500' },
    { label: 'Сообщения', icon: MessageCircle, to: '/patient/chat', color: 'bg-violet-500' },
    { label: 'Документы', icon: FileText, to: '/patient/documents', color: 'bg-amber-500' },
  ]

  const isLoading = appointmentsLoading || documentsLoading

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Добрый день, {user?.fullName?.split(' ')[1] || user?.fullName?.split(' ')[0] || user?.username}! 👋
          </h1>
          <p className="text-sm sm:text-base text-slate-600 mt-1">
            Вот что происходит с вашим здоровьем
          </p>
        </div>
        <Link to="/patient/doctors" className="hidden sm:block">
          <Button rightIcon={<ChevronRight className="w-4 h-4" />}>
            Записаться к врачу
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4 sm:p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-sky-500 flex items-center justify-center flex-shrink-0">
              <Video className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.totalConsultations}</p>
              <p className="text-sm text-slate-500">Консультаций</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4 sm:p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.upcomingCount}</p>
              <p className="text-sm text-slate-500">Предстоящих</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4 sm:p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.documentsCount}</p>
              <p className="text-sm text-slate-500">Документов</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4 sm:p-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.unreadMessages}</p>
              <p className="text-sm text-slate-500">Сообщений</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {quickActions.map((action, index) => (
          <Link key={index} to={action.to}>
            <Card hover className="text-center cursor-pointer">
              <CardContent className="p-4 sm:p-6">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 mx-auto ${action.color} rounded-xl flex items-center justify-center mb-2 sm:mb-3`}>
                  <action.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <p className="font-medium text-slate-900 text-xs sm:text-sm">{action.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Предстоящие записи</CardTitle>
              <Link to="/patient/appointments" className="text-sm text-teal-600 hover:text-teal-700">
                Все записи
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
                </div>
              ) : upcomingAppointments.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-600">У вас нет предстоящих записей</p>
                  <Link to="/patient/doctors">
                    <Button variant="outline" size="sm" className="mt-3">
                      Записаться к врачу
                    </Button>
                  </Link>
                </div>
              ) : (
                upcomingAppointments.map((appointment) => {
                  const doctorName = appointment.doctor?.fullName || 'Врач'
                  const specName = typeof appointment.doctor?.specialization === 'object'
                    ? appointment.doctor?.specialization?.name
                    : appointment.doctor?.specialization || ''

                  const appointmentDate = new Date(appointment.dateTime)
                  const now = new Date()

                  // Длительность консультации (из настроек врача или 30 мин по умолчанию)
                  const consultationDuration = appointment.doctor?.consultationDuration || 30
                  // Буфер после окончания консультации (5 минут)
                  const bufferMinutes = 5

                  const fifteenMinBefore = new Date(appointmentDate.getTime() - 15 * 60 * 1000)
                  const consultationEnd = new Date(appointmentDate.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000)
                  const canJoin = ['confirmed', 'pending'].includes(appointment.status) &&
                                  now >= fifteenMinBefore &&
                                  now <= consultationEnd

                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar
                          src={getMediaUrl(appointment.doctor?.photo)}
                          name={doctorName}
                          size="lg"
                        />
                        <div>
                          <h4 className="font-medium text-slate-900">{doctorName}</h4>
                          <p className="text-sm text-slate-500">{specName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span className="text-xs text-slate-600">
                              {formatRelativeDate(appointment.dateTime)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={appointment.status === 'confirmed' ? 'primary' : 'default'}>
                          {appointment.type === 'video' ? 'Видео' : 'Чат'}
                        </Badge>
                        {canJoin && appointment.roomId && (
                          <Link to={`/consultation/${appointment.roomId}`}>
                            <Button size="sm" leftIcon={<Video className="w-4 h-4" />}>
                              Подключиться
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Recent Chats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Сообщения
              </CardTitle>
              <Link to="/patient/chat" className="text-sm text-teal-600 hover:text-teal-700">
                Все
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {chatsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                </div>
              ) : recentConversations.length === 0 ? (
                <p className="text-center text-slate-500 py-4 text-sm">
                  Нет сообщений
                </p>
              ) : (
                recentConversations.map((conv) => {
                  const participant = conv.participants?.find(p => p.id !== user?.id) || {}
                  const participantName = participant.fullName || participant.username || 'Собеседник'
                  
                  return (
                    <Link
                      key={conv.id}
                      to="/patient/chat"
                      className="block p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar name={participantName} size="sm" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-slate-900 text-sm truncate">
                            {participantName}
                          </h4>
                          <p className="text-xs text-slate-500 truncate">
                            {conv.lastMessage?.content || 'Нет сообщений'}
                          </p>
                        </div>
                        {conv.unreadCount > 0 && (
                          <span className="w-5 h-5 bg-teal-600 text-white text-xs font-medium rounded-full flex items-center justify-center">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Health Tips */}
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Activity className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Совет дня</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    Регулярные профилактические осмотры помогают выявить заболевания на ранних стадиях
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default PatientDashboard
