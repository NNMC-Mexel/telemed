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
import api, { normalizeResponse, getMediaUrl } from '../../services/api'
import { formatDate, formatPrice } from '../../utils/helpers'

function AdminDashboard() {
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
      const usersRes = await api.get('/api/users?populate=*')
      const usersData = usersRes.data || []
      
      // Получаем врачей
      const doctorsRes = await api.get('/api/doctors?populate=*&sort=rating:desc')
      const { data: doctorsData } = normalizeResponse(doctorsRes)
      
      // Получаем записи
      const appointmentsRes = await api.get('/api/appointments?populate=*&sort=createdAt:desc&pagination[limit]=10')
      const { data: appointmentsData } = normalizeResponse(appointmentsRes)
      
      // Получаем все завершённые записи для подсчёта дохода
      const completedRes = await api.get('/api/appointments?filters[status][$eq]=completed')
      const { data: completedData } = normalizeResponse(completedRes)
      
      // Подсчитываем статистику
      const totalRevenue = (completedData || []).reduce((sum, apt) => sum + (apt.price || 0), 0)
      
      setStats({
        totalUsers: usersData.length,
        totalDoctors: (doctorsData || []).length,
        totalAppointments: (appointmentsData || []).length,
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
      pending: { variant: 'default', label: 'Ожидает' },
      confirmed: { variant: 'primary', label: 'Подтв.' },
      completed: { variant: 'success', label: 'Завершён' },
      cancelled: { variant: 'danger', label: 'Отменён' },
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
        <h1 className="text-2xl font-bold text-slate-900">Панель администратора</h1>
        <p className="text-slate-600">Обзор системы и статистика</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-sky-500 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalUsers}</p>
                <p className="text-sm text-slate-500">Пользователей</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalDoctors}</p>
                <p className="text-sm text-slate-500">Врачей</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.totalAppointments}</p>
                <p className="text-sm text-slate-500">Записей</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatPrice(stats.totalRevenue)}</p>
                <p className="text-sm text-slate-500">Доход</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Новые пользователи</CardTitle>
            <Link to="/admin/users" className="text-sm text-teal-600 hover:text-teal-700">
              Все →
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Нет пользователей</p>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                  <Avatar 
                    src={getMediaUrl(user.avatar)} 
                    name={user.fullName || user.username} 
                    size="sm" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {user.fullName || user.username}
                    </p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </div>
                  <Badge variant={user.userRole === 'doctor' ? 'primary' : 'default'}>
                    {user.userRole === 'doctor' ? 'Врач' : 'Пациент'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Appointments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Последние записи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAppointments.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Нет записей</p>
            ) : (
              recentAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar 
                      name={apt.patient?.fullName || 'Пациент'} 
                      size="sm" 
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {apt.patient?.fullName || 'Пациент'}
                      </p>
                      <p className="text-xs text-slate-500">
                        → {apt.doctor?.fullName || 'Врач'}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(apt.status)}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Doctors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Топ врачи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topDoctors.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Нет врачей</p>
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
