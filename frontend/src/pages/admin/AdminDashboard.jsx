import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Calendar,
  Video,
  DollarSign,
  TrendingUp,
  ArrowRight,
  Loader2,
  UserPlus,
  Star,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import { useTranslation } from 'react-i18next'
import api, { normalizeResponse, getMediaUrl } from '../../services/api'
import { formatPrice } from '../../utils/helpers'

function AdminDashboard() {
  const { t } = useTranslation()
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDoctors: 0,
    totalAppointments: 0,
    totalRevenue: 0,
  })
  const [recentUsers, setRecentUsers] = useState([])
  const [recentAppointments, setRecentAppointments] = useState([])
  const [topDoctors, setTopDoctors] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setIsLoading(true)
    try {
      // Получаем пользователей
      const usersRes = await api.get('/api/users?populate=*&pagination[limit]=1000')
      const usersData = usersRes.data || []
      
      // Получаем врачей
      const doctorsRes = await api.get('/api/doctors?populate=*&sort=rating:desc&pagination[limit]=1000')
      const { data: doctorsData } = normalizeResponse(doctorsRes)
      
      // Получаем записи
      const appointmentsRes = await api.get('/api/appointments?populate=*&sort=createdAt:desc&pagination[limit]=10')
      const { data: appointmentsData, meta: appointmentsMeta } = normalizeResponse(appointmentsRes)
      
      // Получаем все завершённые записи для подсчёта дохода
      const completedRes = await api.get('/api/appointments?filters[statuse][$eq]=completed&pagination[limit]=1000')
      const { data: completedData } = normalizeResponse(completedRes)
      
      // Подсчитываем статистику
      const totalRevenue = (completedData || []).reduce((sum, apt) => sum + (apt.price || 0), 0)
      
      setStats({
        totalUsers: usersData.length,
        totalDoctors: (doctorsData || []).length,
        totalAppointments: appointmentsMeta?.pagination?.total ?? (appointmentsData || []).length,
        totalRevenue,
      })
      
      // Последние пользователи
      const sortedUsers = [...usersData]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
      setRecentUsers(sortedUsers)
      
      // Последние записи
      setRecentAppointments((appointmentsData || []).slice(0, 5))
      
      // Топ врачи
      setTopDoctors((doctorsData || []).slice(0, 5))
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (status) => {
    const variants = {
      pending: { variant: 'default', label: t('admin.status_pending') },
      confirmed: { variant: 'primary', label: t('admin.status_confirmed_short') },
      completed: { variant: 'success', label: t('admin.status_completed') },
      cancelled: { variant: 'danger', label: t('admin.status_cancelled') },
    }
    const config = variants[status] || { variant: 'default', label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.dashboard_title')}</h1>
        <p className="text-slate-600">{t('admin.dashboard_subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-sky-500 rounded-xl flex items-center justify-center shrink-0 sm:w-12 sm:h-12">
                <Users className="w-5 h-5 text-white sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{stats.totalUsers}</p>
                <p className="text-sm leading-snug text-slate-500">{t('admin.stat_users')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center shrink-0 sm:w-12 sm:h-12">
                <UserPlus className="w-5 h-5 text-white sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{stats.totalDoctors}</p>
                <p className="text-sm leading-snug text-slate-500">{t('admin.stat_doctors')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shrink-0 sm:w-12 sm:h-12">
                <Calendar className="w-5 h-5 text-white sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <p className="text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{stats.totalAppointments}</p>
                <p className="text-sm leading-snug text-slate-500">{t('admin.stat_appointments')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center shrink-0 sm:w-12 sm:h-12">
                <DollarSign className="w-5 h-5 text-white sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 w-full">
                <p className="whitespace-nowrap text-[clamp(1rem,4.5vw,1.5rem)] font-bold leading-tight text-slate-900">{formatPrice(stats.totalRevenue)}</p>
                <p className="text-sm leading-snug text-slate-500">{t('admin.stat_revenue')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Users */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="min-w-0 truncate">{t('admin.new_users')}</CardTitle>
            <Link to="/admin/users" className="shrink-0 text-sm text-teal-600 hover:text-teal-700">
              {t('admin.all_link')}
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-center text-slate-500 py-4">{t('admin.no_users')}</p>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="flex min-w-0 items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                  <Avatar 
                    src={getMediaUrl(user.avatar)} 
                    name={user.fullName || user.username} 
                    size="sm" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {user.fullName || user.username}
                    </p>
                    <p className="text-xs text-slate-500 wrap-break-word">{user.email}</p>
                  </div>
                  <Badge variant={user.userRole === 'doctor' ? 'primary' : 'default'} className="shrink-0">
                    {user.userRole === 'doctor' ? t('admin.role_doctor') : t('admin.role_patient')}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Appointments */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.recent_appointments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAppointments.length === 0 ? (
              <p className="text-center text-slate-500 py-4">{t('admin.no_appointments')}</p>
            ) : (
              recentAppointments.map((apt) => (
                <div key={apt.id} className="flex min-w-0 items-center justify-between gap-3 p-2 hover:bg-slate-50 rounded-lg">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar 
                      name={apt.patient?.fullName || t('admin.role_patient')}
                      size="sm" 
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {apt.patient?.fullName || t('admin.role_patient')}
                      </p>
                      <p className="text-xs text-slate-500 wrap-break-word">
                        → {apt.doctor?.fullName || t('admin.role_doctor')}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">{getStatusBadge(apt.status)}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Doctors */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('admin.top_doctors')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topDoctors.length === 0 ? (
              <p className="text-center text-slate-500 py-4">{t('admin.no_doctors')}</p>
            ) : (
              topDoctors.map((doctor, index) => {
                const specName = typeof doctor.specialization === 'object'
                  ? doctor.specialization?.name
                  : doctor.specialization || ''
                
                return (
                  <div key={doctor.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                    <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
                      {index + 1}
                    </span>
                    <Avatar 
                      src={getMediaUrl(doctor.photo)} 
                      name={doctor.fullName} 
                      size="sm" 
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{doctor.fullName}</p>
                      <p className="text-xs text-slate-500">{specName}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium">{doctor.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default AdminDashboard
