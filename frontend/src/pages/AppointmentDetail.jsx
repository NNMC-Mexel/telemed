import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  MessageCircle,
  User,
  FileText,
  ExternalLink,
  Loader2,
  Stethoscope,
  Phone,
  Mail,
  FolderOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import useAuthStore from '../stores/authStore'
import { appointmentsAPI, getMediaUrl } from '../services/api'

function AppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const userRole = user?.userRole || 'patient'
  const isDoctor = userRole === 'doctor'

  const [appointment, setAppointment] = useState(null)
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAppointment = async () => {
      setIsLoading(true)
      try {
        const response = await appointmentsAPI.getOne(id)
        const apt = response.data?.data || response.data
        setAppointment(apt)
      } catch (err) {
        console.error('Error fetching appointment:', err)
      } finally {
        setIsLoading(false)
      }
    }
    if (id) fetchAppointment()
  }, [id])

  useEffect(() => {
    if (!appointment) return
    // Use medical_documents populated directly from the appointment response
    const aptDocs = appointment.medical_documents || []
    setDocuments(aptDocs)
  }, [appointment])

  const backPath = isDoctor ? '/doctor' : '/patient/appointments'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <p className="text-slate-500 mb-4">Запись не найдена</p>
          <Button onClick={() => navigate(backPath)}>Назад</Button>
        </div>
      </div>
    )
  }

  const doctorName = appointment.doctor?.fullName || 'Врач'
  const specName =
    typeof appointment.doctor?.specialization === 'object'
      ? appointment.doctor.specialization?.name
      : appointment.doctor?.specialization || ''
  const patientName =
    appointment.patient?.fullName ||
    appointment.patient?.username ||
    appointment.patient?.email?.split('@')[0] ||
    'Пациент'

  const appointmentDate = new Date(appointment.dateTime)
  const formattedDate = appointmentDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const formattedTime = appointmentDate.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const statusMap = {
    confirmed: { label: 'Подтверждён', variant: 'success' },
    pending: { label: 'Ожидает', variant: 'default' },
    cancelled: { label: 'Отменён', variant: 'danger' },
    completed: { label: 'Завершён', variant: 'success' },
  }

  const status = statusMap[appointment.status || appointment.statuse] || statusMap.pending

  const consultationDuration = appointment.doctor?.consultationDuration || 30
  const bufferMinutes = 5
  const consultationEnd = new Date(
    appointmentDate.getTime() + (consultationDuration + bufferMinutes) * 60 * 1000
  )
  const isPast = new Date() > consultationEnd

  const typeLabels = {
    analysis: 'Анализ',
    prescription: 'Назначение',
    certificate: 'Справка',
    other: 'Другое',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back button */}
      <Link
        to={backPath}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">Назад</span>
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Детали записи</h1>
        <div className="flex items-center gap-2">
          {isPast && appointment.status !== 'cancelled' ? (
            <Badge variant="success">Завершён</Badge>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment Info Card */}
          <Card>
            <CardContent>
              <div className="flex items-start gap-5">
                <Avatar
                  src={getMediaUrl(isDoctor ? appointment.patient?.avatar : appointment.doctor?.photo)}
                  name={isDoctor ? patientName : doctorName}
                  size="lg"
                />
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-slate-900">
                    {isDoctor ? patientName : doctorName}
                  </h2>
                  {!isDoctor && specName && (
                    <p className="text-teal-600 font-medium mt-0.5">{specName}</p>
                  )}

                  <div className="flex flex-wrap gap-4 mt-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-sm">{formattedTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      {appointment.type === 'video' ? (
                        <Video className="w-4 h-4 text-slate-400" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-slate-400" />
                      )}
                      <span className="text-sm">
                        {appointment.type === 'video' ? 'Видеоконсультация' : 'Чат'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documents Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-teal-600" />
                Медицинские документы
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">Нет документов по данной записи</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const fileUrl = doc.file?.url ? getMediaUrl(doc.file) : null
                    return (
                      <div
                        key={doc.id}
                        className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-slate-900">
                            {doc.title || 'Документ'}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {typeLabels[doc.type] || doc.type}
                            {doc.createdAt && (
                              <> &middot; {new Date(doc.createdAt).toLocaleDateString('ru-RU')}</>
                            )}
                          </p>
                          {doc.description && (
                            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                              {doc.description}
                            </p>
                          )}
                        </div>
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors flex-shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isDoctor ? 'Пациент' : 'Врач'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-700">
                    {isDoctor ? patientName : doctorName}
                  </span>
                </div>
                {!isDoctor && specName && (
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">{specName}</span>
                  </div>
                )}
                {(isDoctor ? appointment.patient?.phone : appointment.doctor?.phone) && (
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">
                      {isDoctor ? appointment.patient.phone : appointment.doctor.phone}
                    </span>
                  </div>
                )}
                {(isDoctor ? appointment.patient?.email : appointment.doctor?.email) && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">
                      {isDoctor ? appointment.patient.email : appointment.doctor.email}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Price */}
          {(appointment.price || appointment.doctor?.price) && (
            <Card>
              <CardContent>
                <p className="text-sm text-slate-500 mb-1">Стоимость</p>
                <p className="text-2xl font-bold text-slate-900">
                  {(appointment.price || appointment.doctor?.price || 0).toLocaleString('ru-RU')} ₸
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default AppointmentDetail
