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
  Lock,
  Check,
  Paperclip,
  X,
  MessageSquare,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import useAuthStore from '../stores/authStore'
import { appointmentsAPI, documentsAPI, uploadFile, getMediaUrl } from '../services/api'

// 48-hour window for post-consultation notes
const WINDOW_HOURS = 48

function AppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const userRole = user?.userRole || 'patient'
  const isDoctor = userRole === 'doctor'

  const [appointment, setAppointment] = useState(null)
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Post-consultation notes state (doctors only)
  const [activeNotesTab, setActiveNotesTab] = useState('diagnosis')
  const [diagnosisText, setDiagnosisText] = useState('')
  const [planText, setPlanText] = useState('')
  const [prescriptionsText, setPrescriptionsText] = useState('')
  const [diagnosisFile, setDiagnosisFile] = useState(null)
  const [planFile, setPlanFile] = useState(null)
  const [prescriptionsFile, setPrescriptionsFile] = useState(null)
  const [existingDocIds, setExistingDocIds] = useState({ certificate: null, other: null, prescription: null })
  const [isSavingDiagnosis, setIsSavingDiagnosis] = useState(false)
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [isSavingPrescriptions, setIsSavingPrescriptions] = useState(false)
  const [diagnosisSaved, setDiagnosisSaved] = useState(false)
  const [planSaved, setPlanSaved] = useState(false)
  const [prescriptionsSaved, setPrescriptionsSaved] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [isUploadingPlanFile, setIsUploadingPlanFile] = useState(false)
  const [isUploadingPrescriptionsFile, setIsUploadingPrescriptionsFile] = useState(false)

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
    const aptDocs = appointment.medical_documents || []
    setDocuments(aptDocs)
  }, [appointment])

  // Preload existing documents into notes fields
  useEffect(() => {
    if (!documents.length) return
    const cert = documents.find(d => d.type === 'certificate')
    const plan = documents.find(d => d.type === 'other')
    const presc = documents.find(d => d.type === 'prescription')

    if (cert) {
      setDiagnosisText(cert.description || '')
      setExistingDocIds(prev => ({ ...prev, certificate: cert.documentId || cert.id }))
      if (cert.file) setDiagnosisFile(cert.file)
    }
    if (plan) {
      setPlanText(plan.description || '')
      setExistingDocIds(prev => ({ ...prev, other: plan.documentId || plan.id }))
      if (plan.file) setPlanFile(plan.file)
    }
    if (presc) {
      setPrescriptionsText(presc.description || '')
      setExistingDocIds(prev => ({ ...prev, prescription: presc.documentId || presc.id }))
      if (presc.file) setPrescriptionsFile(presc.file)
    }
  }, [documents])

  const backPath = isDoctor ? '/doctor' : '/patient/appointments'

  // ── Save functions ──────────────────────────────────────────────

  const handleDiagnosisFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingFile(true)
    try {
      const uploaded = await uploadFile(file)
      setDiagnosisFile(uploaded)
    } catch (err) {
      console.error('Error uploading file:', err)
    } finally {
      setIsUploadingFile(false)
    }
  }

  const saveDiagnosis = async () => {
    if (!appointment?.id) return
    setIsSavingDiagnosis(true)
    try {
      if (existingDocIds.certificate) {
        await documentsAPI.update(existingDocIds.certificate, {
          description: diagnosisText || '',
          ...(diagnosisFile?.id && { file: diagnosisFile.id }),
        })
      } else {
        const res = await documentsAPI.create({
          title: 'Заключение врача',
          type: 'certificate',
          description: diagnosisText || '',
          ...(diagnosisFile?.id && { file: diagnosisFile.id }),
          appointment: appointment.id,
          user: appointment.patient?.id,
          doctor: appointment.doctor?.id,
        })
        const newDoc = res.data?.data
        if (newDoc) setExistingDocIds(prev => ({ ...prev, certificate: newDoc.documentId || newDoc.id }))
      }
      setDiagnosisSaved(true)
      setTimeout(() => setDiagnosisSaved(false), 2000)
    } catch (err) {
      console.error('Error saving diagnosis:', err)
    } finally {
      setIsSavingDiagnosis(false)
    }
  }

  const handlePlanFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingPlanFile(true)
    try {
      const uploaded = await uploadFile(file)
      setPlanFile(uploaded)
    } catch (err) {
      console.error('Error uploading plan file:', err)
    } finally {
      setIsUploadingPlanFile(false)
    }
  }

  const handlePrescriptionsFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingPrescriptionsFile(true)
    try {
      const uploaded = await uploadFile(file)
      setPrescriptionsFile(uploaded)
    } catch (err) {
      console.error('Error uploading prescriptions file:', err)
    } finally {
      setIsUploadingPrescriptionsFile(false)
    }
  }

  const savePlan = async () => {
    if (!appointment?.id || (!planText.trim() && !planFile)) return
    setIsSavingPlan(true)
    try {
      if (existingDocIds.other) {
        await documentsAPI.update(existingDocIds.other, {
          description: planText,
          ...(planFile?.id && { file: planFile.id }),
        })
      } else {
        const res = await documentsAPI.create({
          title: 'План обследования',
          type: 'other',
          description: planText,
          ...(planFile?.id && { file: planFile.id }),
          appointment: appointment.id,
          user: appointment.patient?.id,
          doctor: appointment.doctor?.id,
        })
        const newDoc = res.data?.data
        if (newDoc) setExistingDocIds(prev => ({ ...prev, other: newDoc.documentId || newDoc.id }))
      }
      setPlanSaved(true)
      setTimeout(() => setPlanSaved(false), 2000)
    } catch (err) {
      console.error('Error saving plan:', err)
    } finally {
      setIsSavingPlan(false)
    }
  }

  const savePrescriptions = async () => {
    if (!appointment?.id || (!prescriptionsText.trim() && !prescriptionsFile)) return
    setIsSavingPrescriptions(true)
    try {
      if (existingDocIds.prescription) {
        await documentsAPI.update(existingDocIds.prescription, {
          description: prescriptionsText,
          ...(prescriptionsFile?.id && { file: prescriptionsFile.id }),
        })
      } else {
        const res = await documentsAPI.create({
          title: 'Назначения',
          type: 'prescription',
          description: prescriptionsText,
          ...(prescriptionsFile?.id && { file: prescriptionsFile.id }),
          appointment: appointment.id,
          user: appointment.patient?.id,
          doctor: appointment.doctor?.id,
        })
        const newDoc = res.data?.data
        if (newDoc) setExistingDocIds(prev => ({ ...prev, prescription: newDoc.documentId || newDoc.id }))
      }
      setPrescriptionsSaved(true)
      setTimeout(() => setPrescriptionsSaved(false), 2000)
    } catch (err) {
      console.error('Error saving prescriptions:', err)
    } finally {
      setIsSavingPrescriptions(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────

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
  const isPast = new Date() > consultationEnd || (appointment.statuse || appointment.status) === 'completed'

  // 48-hour post-consultation window
  const windowEnd = new Date(consultationEnd.getTime() + WINDOW_HOURS * 60 * 60 * 1000)
  const now = new Date()
  const isWithinWindow = now < windowEnd
  const hoursRemaining = Math.max(0, Math.floor((windowEnd - now) / (1000 * 60 * 60)))
  const isCompleted = isPast && (appointment.statuse || appointment.status) !== 'cancelled'

  const typeLabels = {
    analysis: 'Анализ',
    prescription: 'Назначение',
    certificate: 'Справка',
    other: 'Другое',
  }

  const notesTabs = [
    { key: 'diagnosis', label: 'Диагноз' },
    { key: 'plan', label: 'План обследования' },
    { key: 'prescriptions', label: 'Назначения' },
  ]

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
          {isPast && (appointment.status || appointment.statuse) !== 'cancelled' ? (
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

          {/* Post-Consultation Notes (Doctor only, completed appointments) */}
          {isDoctor && isCompleted && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-teal-600" />
                    Заключение по консультации
                  </div>
                  {isWithinWindow ? (
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                      Осталось {hoursRemaining} ч.
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Lock className="w-3 h-3" />
                      Заблокировано
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Lock banner */}
                {!isWithinWindow && (
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4">
                    <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">Срок добавления заключения истёк</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Заключение можно добавлять в течение {WINDOW_HOURS} часов после консультации
                      </p>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
                  {notesTabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveNotesTab(tab.key)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeNotesTab === tab.key
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Diagnosis tab */}
                {activeNotesTab === 'diagnosis' && (
                  <div className="space-y-3">
                    <textarea
                      value={diagnosisText}
                      onChange={e => setDiagnosisText(e.target.value)}
                      disabled={!isWithinWindow}
                      placeholder="Введите диагноз и заключение..."
                      rows={5}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    {isWithinWindow && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors text-sm text-slate-600">
                          <Paperclip className="w-4 h-4" />
                          {isUploadingFile
                            ? 'Загрузка...'
                            : diagnosisFile
                            ? (diagnosisFile.name || 'Файл прикреплён')
                            : 'Прикрепить файл'}
                          <input
                            type="file"
                            className="hidden"
                            onChange={handleDiagnosisFile}
                            disabled={isUploadingFile}
                          />
                        </label>
                        {diagnosisFile && (
                          <button
                            onClick={() => setDiagnosisFile(null)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    {!isWithinWindow && diagnosisFile && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Paperclip className="w-4 h-4 text-slate-400" />
                        <span>{diagnosisFile.name || 'Прикреплённый файл'}</span>
                        {diagnosisFile.url && (
                          <a
                            href={getMediaUrl(diagnosisFile)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-600 hover:underline"
                          >
                            Открыть
                          </a>
                        )}
                      </div>
                    )}
                    {isWithinWindow && (
                      <Button
                        size="sm"
                        onClick={saveDiagnosis}
                        isLoading={isSavingDiagnosis}
                        leftIcon={diagnosisSaved ? <Check className="w-4 h-4" /> : null}
                        className={diagnosisSaved ? 'bg-green-600! hover:bg-green-700!' : ''}
                      >
                        {diagnosisSaved ? 'Сохранено' : 'Сохранить'}
                      </Button>
                    )}
                  </div>
                )}

                {/* Plan tab */}
                {activeNotesTab === 'plan' && (
                  <div className="space-y-3">
                    <textarea
                      value={planText}
                      onChange={e => setPlanText(e.target.value)}
                      disabled={!isWithinWindow}
                      placeholder="Введите план обследования и рекомендации..."
                      rows={5}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    {isWithinWindow && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors text-sm text-slate-600">
                          <Paperclip className="w-4 h-4" />
                          {isUploadingPlanFile ? 'Загрузка...' : planFile ? (planFile.name || 'Файл прикреплён') : 'Прикрепить файл'}
                          <input type="file" className="hidden" onChange={handlePlanFile} disabled={isUploadingPlanFile} />
                        </label>
                        {planFile && (
                          <button onClick={() => setPlanFile(null)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    {!isWithinWindow && planFile && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Paperclip className="w-4 h-4 text-slate-400" />
                        <span>{planFile.name || 'Прикреплённый файл'}</span>
                        {planFile.url && (
                          <a href={getMediaUrl(planFile)} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Открыть</a>
                        )}
                      </div>
                    )}
                    {isWithinWindow && (
                      <Button
                        size="sm"
                        onClick={savePlan}
                        isLoading={isSavingPlan}
                        leftIcon={planSaved ? <Check className="w-4 h-4" /> : null}
                        className={planSaved ? 'bg-green-600! hover:bg-green-700!' : ''}
                      >
                        {planSaved ? 'Сохранено' : 'Сохранить'}
                      </Button>
                    )}
                  </div>
                )}

                {/* Prescriptions tab */}
                {activeNotesTab === 'prescriptions' && (
                  <div className="space-y-3">
                    <textarea
                      value={prescriptionsText}
                      onChange={e => setPrescriptionsText(e.target.value)}
                      disabled={!isWithinWindow}
                      placeholder="Введите назначения и лекарства..."
                      rows={5}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    {isWithinWindow && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors text-sm text-slate-600">
                          <Paperclip className="w-4 h-4" />
                          {isUploadingPrescriptionsFile ? 'Загрузка...' : prescriptionsFile ? (prescriptionsFile.name || 'Файл прикреплён') : 'Прикрепить файл'}
                          <input type="file" className="hidden" onChange={handlePrescriptionsFile} disabled={isUploadingPrescriptionsFile} />
                        </label>
                        {prescriptionsFile && (
                          <button onClick={() => setPrescriptionsFile(null)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    {!isWithinWindow && prescriptionsFile && (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Paperclip className="w-4 h-4 text-slate-400" />
                        <span>{prescriptionsFile.name || 'Прикреплённый файл'}</span>
                        {prescriptionsFile.url && (
                          <a href={getMediaUrl(prescriptionsFile)} target="_blank" rel="noopener noreferrer" className="text-teal-600 hover:underline">Открыть</a>
                        )}
                      </div>
                    )}
                    {isWithinWindow && (
                      <Button
                        size="sm"
                        onClick={savePrescriptions}
                        isLoading={isSavingPrescriptions}
                        leftIcon={prescriptionsSaved ? <Check className="w-4 h-4" /> : null}
                        className={prescriptionsSaved ? 'bg-green-600! hover:bg-green-700!' : ''}
                      >
                        {prescriptionsSaved ? 'Сохранено' : 'Сохранить'}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Chat History Card */}
          {appointment.chatLog?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-teal-600" />
                  История переписки
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {appointment.chatLog.map((msg, idx) => {
                    const currentUserName = user?.fullName || user?.username || ''
                    const isMe = msg.senderName === currentUserName
                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <span className="text-xs text-slate-400 mb-1 px-1">{msg.senderName}</span>
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                            isMe
                              ? 'bg-teal-600 text-white rounded-br-sm'
                              : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap wrap-break-word">{msg.text}</p>
                          {msg.time && (
                            <p className={`text-xs mt-1 ${isMe ? 'text-teal-100' : 'text-slate-400'}`}>
                              {new Date(msg.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

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
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
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
                            className="p-2 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors shrink-0"
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

          {/* Window info card (doctor only, completed) */}
          {isDoctor && isCompleted && (
            <Card>
              <CardContent>
                <div className="flex items-center gap-2 mb-2">
                  {isWithinWindow ? (
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-400" />
                  )}
                  <p className="text-sm font-medium text-slate-700">
                    {isWithinWindow ? 'Окно заключения открыто' : 'Окно заключения закрыто'}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {isWithinWindow
                    ? `Доступно ещё ${hoursRemaining} ч. для добавления заключения`
                    : `Срок в ${WINDOW_HOURS} часов после консультации истёк`}
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
