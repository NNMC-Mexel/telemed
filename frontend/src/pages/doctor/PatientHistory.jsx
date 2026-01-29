import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  MessageCircle,
  FileText,
  Loader2,
  User,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  ClipboardList,
  Pill,
  ExternalLink,
  FolderOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import useAuthStore from '../../stores/authStore'
import api, { normalizeResponse, getMediaUrl, documentsAPI } from '../../services/api'

function PatientHistory() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [patient, setPatient] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [expandedAppointment, setExpandedAppointment] = useState(null)

  useEffect(() => {
    if (user?.id && patientId) {
      fetchData()
    }
  }, [user, patientId])

  const fetchData = async () => {
    try {
      // Get doctor record
      const doctorRes = await api.get(`/api/doctors?filters[userId][$eq]=${user.id}&populate=*`)
      const doctorData = doctorRes.data?.data?.[0]
      if (!doctorData) return

      // Get all appointments between this doctor and patient
      const aptsRes = await api.get(
        `/api/appointments?filters[doctor][documentId][$eq]=${doctorData.documentId}&filters[patient][id][$eq]=${patientId}&populate[patient][populate]=*&populate[doctor][populate]=*&sort=dateTime:desc`
      )
      const { data: aptsData } = normalizeResponse(aptsRes)
      setAppointments(aptsData || [])

      // Get patient info from first appointment
      if (aptsData?.length > 0 && aptsData[0].patient) {
        setPatient(aptsData[0].patient)
      }

      // Get all medical documents for this patient from this doctor
      const docsRes = await documentsAPI.getAll({ userId: patientId })
      const allDocs = docsRes.data?.data || []
      // Filter docs created by this doctor
      const doctorDocs = allDocs.filter(
        (doc) => doc.doctor?.id === doctorData.id || doc.doctor?.documentId === doctorData.documentId
      )
      setDocuments(doctorDocs)
    } catch (error) {
      console.error('Error fetching patient history:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getDocsForAppointment = (aptId, aptDocumentId) => {
    return documents.filter(
      (doc) =>
        doc.appointment === aptId ||
        doc.appointment?.id === aptId ||
        doc.appointment === aptDocumentId ||
        doc.appointment?.documentId === aptDocumentId
    )
  }

  const toggleAppointment = (aptId) => {
    setExpandedAppointment(expandedAppointment === aptId ? null : aptId)
  }

  const statusMap = {
    confirmed: { label: 'Подтверждён', variant: 'success' },
    pending: { label: 'Ожидает', variant: 'default' },
    cancelled: { label: 'Отменён', variant: 'danger' },
    completed: { label: 'Завершён', variant: 'success' },
    in_progress: { label: 'В процессе', variant: 'default' },
  }

  const docTypeLabels = {
    certificate: 'Заключение врача',
    prescription: 'Назначения',
    analysis: 'Анализ',
    other: 'План обследования',
  }

  const docTypeIcons = {
    certificate: Stethoscope,
    prescription: Pill,
    analysis: FileText,
    other: ClipboardList,
  }

  const docTypeColors = {
    certificate: 'bg-teal-100 text-teal-600',
    prescription: 'bg-violet-100 text-violet-600',
    analysis: 'bg-amber-100 text-amber-600',
    other: 'bg-sky-100 text-sky-600',
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  const patientName = patient?.fullName || patient?.username || 'Пациент'

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Back button */}
      <Link
        to="/doctor/patients"
        className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">К списку пациентов</span>
      </Link>

      {/* Patient Info Header */}
      <Card>
        <CardContent>
          <div className="flex items-center gap-5">
            <Avatar
              src={getMediaUrl(patient?.avatar)}
              name={patientName}
              size="xl"
            />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{patientName}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2">
                {patient?.email && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Mail className="w-4 h-4" />
                    {patient.email}
                  </span>
                )}
                {patient?.phone && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Phone className="w-4 h-4" />
                    {patient.phone}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-teal-600">{appointments.length}</p>
              <p className="text-sm text-slate-500">визитов</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Timeline */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">История визитов</h2>

        {appointments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Нет записей с этим пациентом</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {appointments.map((apt) => {
              const aptDate = new Date(apt.dateTime)
              const formattedDate = aptDate.toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })
              const formattedTime = aptDate.toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
              })

              const aptStatus = apt.status || apt.statuse
              const consultationDuration = apt.doctor?.consultationDuration || 30
              const consultationEnd = new Date(
                aptDate.getTime() + (consultationDuration + 5) * 60 * 1000
              )
              const isPast = new Date() > consultationEnd
              const displayStatus =
                isPast && aptStatus !== 'cancelled'
                  ? statusMap.completed
                  : statusMap[aptStatus] || statusMap.pending

              const aptDocs = getDocsForAppointment(apt.id, apt.documentId)
              const isExpanded = expandedAppointment === apt.id

              return (
                <Card key={apt.id} className="overflow-hidden">
                  <button
                    onClick={() => toggleAppointment(apt.id)}
                    className="w-full text-left"
                  >
                    <CardContent>
                      <div className="flex items-center gap-4">
                        {/* Date column */}
                        <div className="w-16 h-16 rounded-xl bg-slate-100 flex flex-col items-center justify-center flex-shrink-0">
                          <span className="text-xl font-bold text-slate-900">
                            {aptDate.getDate()}
                          </span>
                          <span className="text-xs text-slate-500 uppercase">
                            {aptDate.toLocaleDateString('ru-RU', { month: 'short' })}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-slate-900">
                              Консультация
                            </h3>
                            <Badge variant={displayStatus.variant} className="text-xs">
                              {displayStatus.label}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formattedTime}
                            </span>
                            <span className="flex items-center gap-1">
                              {apt.type === 'video' ? (
                                <Video className="w-3.5 h-3.5" />
                              ) : (
                                <MessageCircle className="w-3.5 h-3.5" />
                              )}
                              {apt.type === 'video' ? 'Видео' : 'Чат'}
                            </span>
                            {aptDocs.length > 0 && (
                              <span className="flex items-center gap-1 text-teal-600">
                                <FileText className="w-3.5 h-3.5" />
                                {aptDocs.length} док.
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Expand icon */}
                        <div className="flex-shrink-0 text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-6 space-y-4">
                      {aptDocs.length === 0 ? (
                        <div className="text-center py-6">
                          <FolderOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="text-sm text-slate-500">
                            Нет заключений по этому визиту
                          </p>
                        </div>
                      ) : (
                        aptDocs.map((doc) => {
                          const DocIcon = docTypeIcons[doc.type] || FileText
                          const colorClasses = docTypeColors[doc.type] || 'bg-slate-100 text-slate-600'
                          const fileUrl = doc.file?.url ? getMediaUrl(doc.file) : null

                          return (
                            <div
                              key={doc.id}
                              className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm"
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClasses}`}>
                                  <DocIcon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <h4 className="font-medium text-slate-900">
                                      {doc.title || docTypeLabels[doc.type] || 'Документ'}
                                    </h4>
                                    {fileUrl && (
                                      <a
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors flex-shrink-0"
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {docTypeLabels[doc.type] || doc.type}
                                    {doc.createdAt && (
                                      <> &middot; {new Date(doc.createdAt).toLocaleDateString('ru-RU')}</>
                                    )}
                                  </p>
                                  {doc.description && (
                                    <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-lg p-3">
                                      {doc.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}

                      {/* Link to full appointment detail */}
                      <div className="pt-2">
                        <Link to={`/doctor/appointments/${apt.documentId}`}>
                          <Button variant="ghost" size="sm" className="text-teal-600">
                            Подробнее о визите
                            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default PatientHistory
