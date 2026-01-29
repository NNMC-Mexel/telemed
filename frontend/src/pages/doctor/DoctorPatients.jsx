import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users,
  Search,
  Calendar,
  MessageCircle,
  FileText,
  MoreVertical,
  Phone,
  Mail,
  Clock,
  Loader2,
  History,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import useAuthStore from '../../stores/authStore'
import api, { normalizeResponse, getMediaUrl } from '../../services/api'
import { formatDate } from '../../utils/helpers'

function DoctorPatients() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [doctor, setDoctor] = useState(null)

  useEffect(() => {
    fetchDoctorAndPatients()
  }, [user])

  const fetchDoctorAndPatients = async () => {
    if (!user?.id) return
    
    try {
      // Получаем профиль врача по userId
      const doctorResponse = await api.get(`/api/doctors?filters[userId][$eq]=${user.id}&populate=*`)
      const doctorData = doctorResponse.data?.data?.[0]
      setDoctor(doctorData)
      
      if (doctorData?.id) {
        // Получаем все appointments этого врача с информацией о пациентах
        const appointmentsResponse = await api.get(
          `/api/appointments?filters[doctor][documentId][$eq]=${doctorData.documentId}&populate[patient][populate]=*&sort=createdAt:desc`
        )
        const { data: appointments } = normalizeResponse(appointmentsResponse)
        
        // Извлекаем уникальных пациентов
        const patientsMap = new Map()
        appointments?.forEach(apt => {
          if (apt.patient && !patientsMap.has(apt.patient.id)) {
            patientsMap.set(apt.patient.id, {
              ...apt.patient,
              lastVisit: apt.dateTime,
              appointmentsCount: 1,
              status: apt.status,
            })
          } else if (apt.patient) {
            const existing = patientsMap.get(apt.patient.id)
            existing.appointmentsCount++
          }
        })
        
        setPatients(Array.from(patientsMap.values()))
      }
    } catch (error) {
      console.error('Error fetching patients:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredPatients = patients.filter(patient => {
    const name = patient.fullName || patient.username || ''
    const email = patient.email || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           email.toLowerCase().includes(searchQuery.toLowerCase())
  })

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
          <h1 className="text-2xl font-bold text-slate-900">Мои пациенты</h1>
          <p className="text-slate-600">Список пациентов, которые обращались к вам</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center">
              <Users className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{patients.length}</p>
              <p className="text-sm text-slate-500">Всего пациентов</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {patients.filter(p => {
                  const lastVisit = new Date(p.lastVisit)
                  const weekAgo = new Date()
                  weekAgo.setDate(weekAgo.getDate() - 7)
                  return lastVisit >= weekAgo
                }).length}
              </p>
              <p className="text-sm text-slate-500">За эту неделю</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {patients.filter(p => p.status === 'pending' || p.status === 'confirmed').length}
              </p>
              <p className="text-sm text-slate-500">Ожидают приёма</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск пациентов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients List */}
      {filteredPatients.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {searchQuery ? 'Пациенты не найдены' : 'Пока нет пациентов'}
            </h3>
            <p className="text-slate-600">
              {searchQuery 
                ? 'Попробуйте изменить параметры поиска' 
                : 'Здесь появятся пациенты, которые запишутся к вам на приём'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPatients.map((patient) => (
            <Card
              key={patient.id}
              hover
              className="cursor-pointer"
              onClick={() => navigate(`/doctor/patients/${patient.id}`)}
            >
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar
                    src={getMediaUrl(patient.avatar)}
                    name={patient.fullName || patient.username}
                    size="lg"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900">
                      {patient.fullName || patient.username || 'Пациент'}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      {patient.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {patient.email}
                        </span>
                      )}
                      {patient.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {patient.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Последний визит</p>
                    <p className="font-medium text-slate-900">{formatDate(patient.lastVisit)}</p>
                  </div>
                  <div className="text-center px-4">
                    <p className="text-2xl font-bold text-teal-600">{patient.appointmentsCount}</p>
                    <p className="text-xs text-slate-500">визитов</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={(e) => e.stopPropagation()}>
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/doctor/patients/${patient.id}`)
                      }}
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/doctor/patients/${patient.id}`)
                      }}
                    >
                      <History className="w-4 h-4 mr-1.5" />
                      История
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default DoctorPatients
