import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
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
  ShieldCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import useAuthStore from '../stores/authStore'
import { useTranslation } from 'react-i18next'
import { appointmentsAPI, documentsAPI, uploadFile, getMediaUrl, downloadMedia } from '../services/api'
import { getSpecName } from '../utils/helpers'
import { DOCUMENT_STATUS, getAppointmentPreparation } from '../utils/appointmentPreparation'

// 48-hour window for post-consultation notes
const WINDOW_HOURS = 48

function AppointmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-US' : 'ru-RU'
  const { user } = useAuthStore()
  const userRole = user?.userRole || 'patient'
  const isDoctor = userRole === 'doctor'

  const [appointment, setAppointment] = useState(null)
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGrantingAccess, setIsGrantingAccess] = useState(false)
  const [accessError, setAccessError] = useState('')

  const documentsSectionRef = useRef(null)
  const accessSectionRef = useRef(null)

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

  useEffect(() => {
    if (!appointment || isLoading || !location.hash) return

    const targetMap = {
      '#documents': documentsSectionRef,
      '#access': accessSectionRef,
    }
    const target = targetMap[location.hash]?.current
    if (!target) return

    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      target.focus?.({ preventScroll: true })
    }, 100)
  }, [appointment, isLoading, location.hash])

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

  const grantDoctorAccess = async () => {
    const doctorDocumentId = appointment?.doctor?.documentId
    const appointmentId = appointment?.documentId || appointment?.id
    if (!appointmentId || !doctorDocumentId || documents.length === 0) return

    setIsGrantingAccess(true)
    setAccessError('')

    try {
      const patientDocuments = documents.filter((doc) => !doc.doctor && (!doc.user?.id || doc.user.id === user?.id))

      await Promise.all(patientDocuments.map((doc) => {
        const existingDoctorIds = (doc.sharedWithDoctors || [])
          .map((doctor) => doctor.documentId)
          .filter(Boolean)
        const nextDoctorIds = [...new Set([...existingDoctorIds, doctorDocumentId])]
        return documentsAPI.share(doc.documentId || doc.id, nextDoctorIds)
      }))

      const nextChecklist = {
        ...(appointment.preparationChecklist || {}),
        documentsReady: true,
        doctorAccessGranted: true,
        selectedDocumentCount: documents.length,
        noDocuments: false,
      }

      await appointmentsAPI.update(appointmentId, {
        doctorAccessGranted: true,
        patientDocumentsStatus: DOCUMENT_STATUS.UPLOADED,
        preparationChecklist: nextChecklist,
        preparationUpdatedAt: new Date().toISOString(),
      })

      setAppointment((prev) => prev
        ? {
            ...prev,
            doctorAccessGranted: true,
            patientDocumentsStatus: DOCUMENT_STATUS.UPLOADED,
            preparationChecklist: nextChecklist,
          }
        : prev)
      setDocuments((prev) => prev.map((doc) => {
        if (doc.doctor) return doc
        const existingDoctors = doc.sharedWithDoctors || []
        if (existingDoctors.some((doctor) => doctor.documentId === doctorDocumentId)) return doc
        return {
          ...doc,
          sharedWithDoctors: [
            ...existingDoctors,
            {
              id: appointment.doctor?.id,
              documentId: doctorDocumentId,
              fullName: appointment.doctor?.fullName,
            },
          ],
        }
      }))
    } catch (err) {
      console.error('Error granting doctor access:', err)
      setAccessError(t('appointment_detail.access_grant_error'))
    } finally {
      setIsGrantingAccess(false)
    }
  }

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
          title: t('video.doc_conclusion'),
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
          title: t('video.doc_plan'),
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
          title: t('video.doc_prescriptions'),
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
          <p className="text-slate-500 mb-4">{t('appointment_detail.not_found')}</p>
          <Button onClick={() => navigate(backPath)}>{t('appointment_detail.back')}</Button>
        </div>
      </div>
    )
  }

  const doctorName = appointment.doctor?.fullName || t('video.doctor')
  const specName = getSpecName(appointment.doctor?.specialization, i18n.language)
  const patientName =
    appointment.patient?.fullName ||
    appointment.patient?.username ||
    appointment.patient?.email?.split('@')[0] ||
    t('video.patient')

  const appointmentDate = new Date(appointment.dateTime)
  const formattedDate = appointmentDate.toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const formattedTime = appointmentDate.toLocaleTimeString(dateLocale, {
    hour: '2-digit',
    minute: '2-digit',
  })

  const statusMap = {
    confirmed: { label: t('appointment_detail.status_confirmed'), variant: 'success' },
    pending: { label: t('appointment_detail.status_pending'), variant: 'default' },
    cancelled: { label: t('appointment_detail.status_cancelled'), variant: 'danger' },
    completed: { label: t('appointment_detail.status_completed'), variant: 'success' },
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
  const preparation = getAppointmentPreparation(appointment)
  const documentsStatusLabel = preparation.documentsStatus === DOCUMENT_STATUS.NO_DOCUMENTS
    ? t('appointments.prep_docs_none')
    : preparation.documentsReady
    ? t('appointments.prep_docs_ready')
    : t('appointments.prep_docs_waiting')
  const accessStatusLabel = preparation.accessReady
    ? t('appointments.prep_access_ready')
    : t('appointments.prep_access_waiting')
  const shareableDocuments = documents.filter((doc) => !doc.doctor && (!doc.user?.id || doc.user.id === user?.id))
  const canGrantAccess = Boolean(
    !isDoctor &&
    !preparation.accessReady &&
    preparation.documentsReady &&
    appointment.doctor?.documentId &&
    shareableDocuments.length > 0
  )

  const typeLabels = {
    analysis: t('appointment_detail.doctype_analysis'),
    prescription: t('appointment_detail.doctype_prescription'),
    certificate: t('appointment_detail.doctype_certificate'),
    other: t('appointment_detail.doctype_other'),
  }

  const notesTabs = [
    { key: 'diagnosis', label: t('video.tab_diagnosis') },
    { key: 'plan', label: t('video.plan_label') },
    { key: 'prescriptions', label: t('video.prescriptions_label') },
  ]

  return (
    <div className="w-full max-w-4xl mx-auto px-3 py-4 sm:p-6 overflow-x-hidden">
      {/* Back button */}
      <Link
        to={backPath}
        className="inline-flex items-center gap-2 text-slate-600 hover:text-teal-600 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('appointment_detail.back')}</span>
      </Link>

      {/* Header */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 break-words">{t('appointment_detail.title')}</h1>
        <div className="flex items-center gap-2 shrink-0">
          {isPast && (appointment.status || appointment.statuse) !== 'cancelled' ? (
            <Badge variant="success">{t('appointment_detail.status_completed')}</Badge>
          ) : (
            <Badge variant={status.variant}>{status.label}</Badge>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Appointment Info Card */}
          <Card>
            <CardContent>
              <div className="flex items-start gap-4 sm:gap-5 min-w-0">
                <div className="shrink-0">
                  <Avatar
                    src={getMediaUrl(isDoctor ? appointment.patient?.avatar : appointment.doctor?.photo)}
                    name={isDoctor ? patientName : doctorName}
                    size="lg"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold text-slate-900 break-words">
                    {isDoctor ? patientName : doctorName}
                  </h2>
                  {!isDoctor && specName && (
                    <p className="text-teal-600 font-medium mt-0.5 break-words">{specName}</p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                    <div className="flex items-center gap-2 text-slate-600 min-w-0">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm">{formattedDate}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="text-sm">{formattedTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 min-w-0">
                      {appointment.type === 'video' ? (
                        <Video className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <MessageCircle className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="text-sm break-words">
                        {appointment.type === 'video' ? t('appointment_detail.type_video') : t('appointment_detail.type_chat')}
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
                <CardTitle className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Stethoscope className="w-5 h-5 text-teal-600 shrink-0" />
                    {t('appointment_detail.notes_title')}
                  </div>
                  {isWithinWindow ? (
                    <span className="shrink-0 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">
                      {t('appointment_detail.hours_left', { hours: hoursRemaining })}
                    </span>
                  ) : (
                    <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                      <Lock className="w-3 h-3" />
                      {t('appointment_detail.locked')}
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
                      <p className="text-sm font-medium text-slate-700">{t('appointment_detail.window_expired_title')}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('appointment_detail.window_info', { hours: WINDOW_HOURS })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tabs */}
                <div className="grid grid-cols-3 gap-1 mb-4 bg-slate-100 p-1 rounded-xl">
                  {notesTabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveNotesTab(tab.key)}
                      className={`min-h-11 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium leading-tight transition-colors ${
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
                      placeholder={t('appointment_detail.diagnosis_placeholder')}
                      rows={5}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    {isWithinWindow && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors text-sm text-slate-600">
                          <Paperclip className="w-4 h-4" />
                          {isUploadingFile
                            ? t('appointment_detail.uploading')
                            : diagnosisFile
                            ? (diagnosisFile.name || t('appointment_detail.file_attached'))
                            : t('appointment_detail.attach_file')}
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
                        <span>{diagnosisFile.name || t('appointment_detail.file_attached')}</span>
                        {diagnosisFile.url && (
                          <button
                            type="button"
                            onClick={() => downloadMedia(diagnosisFile, diagnosisFile.name || 'diagnosis')}
                            className="text-teal-600 hover:underline"
                          >
                            {t('appointment_detail.open')}
                          </button>
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
                        {diagnosisSaved ? t('appointment_detail.saved') : t('appointment_detail.save')}
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
                      placeholder={t('appointment_detail.plan_placeholder')}
                      rows={5}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    {isWithinWindow && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors text-sm text-slate-600">
                          <Paperclip className="w-4 h-4" />
                          {isUploadingPlanFile ? t('appointment_detail.uploading') : planFile ? (planFile.name || t('appointment_detail.file_attached')) : t('appointment_detail.attach_file')}
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
                        <span>{planFile.name || t('appointment_detail.file_attached')}</span>
                        {planFile.url && (
                          <button type="button" onClick={() => downloadMedia(planFile, planFile.name || 'plan')} className="text-teal-600 hover:underline">{t('appointment_detail.open')}</button>
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
                        {planSaved ? t('appointment_detail.saved') : t('appointment_detail.save')}
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
                      placeholder={t('appointment_detail.prescriptions_placeholder')}
                      rows={5}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed"
                    />
                    {isWithinWindow && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 hover:bg-teal-50 transition-colors text-sm text-slate-600">
                          <Paperclip className="w-4 h-4" />
                          {isUploadingPrescriptionsFile ? t('appointment_detail.uploading') : prescriptionsFile ? (prescriptionsFile.name || t('appointment_detail.file_attached')) : t('appointment_detail.attach_file')}
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
                        <span>{prescriptionsFile.name || t('appointment_detail.file_attached')}</span>
                        {prescriptionsFile.url && (
                          <button type="button" onClick={() => downloadMedia(prescriptionsFile, prescriptionsFile.name || 'prescriptions')} className="text-teal-600 hover:underline">{t('appointment_detail.open')}</button>
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
                        {prescriptionsSaved ? t('appointment_detail.saved') : t('appointment_detail.save')}
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
                  {t('appointment_detail.chat_history')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto overflow-x-hidden pr-1">
                  {appointment.chatLog.map((msg, idx) => {
                    const currentUserName = user?.fullName || user?.username || ''
                    const isMe = msg.senderName === currentUserName
                    return (
                      <div
                        key={idx}
                        className={`flex max-w-full flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <span className="max-w-[78vw] truncate text-xs text-slate-400 mb-1 px-1">{msg.senderName}</span>
                        <div
                          className={`max-w-[min(78vw,22rem)] px-4 py-2.5 rounded-2xl text-sm break-words ${
                            isMe
                              ? 'bg-teal-600 text-white rounded-br-sm'
                              : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          {msg.time && (
                            <p className={`text-xs mt-1 ${isMe ? 'text-teal-100' : 'text-slate-400'}`}>
                              {new Date(msg.time).toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' })}
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
          <Card
            ref={documentsSectionRef}
            id="documents"
            tabIndex={-1}
            className="scroll-mt-24 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          >
            <CardHeader>
              <CardTitle className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-teal-600" />
                  {t('appointment_detail.medical_docs')}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                  preparation.documentsReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  <FileText className="w-3.5 h-3.5" />
                  {documentsStatusLabel}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 text-sm">{t('appointment_detail.no_docs')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => {
                    const fileUrl = doc.file?.url ? getMediaUrl(doc.file) : null
                    return (
                      <div
                        key={doc.id}
                        className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors min-w-0"
                      >
                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-slate-900 break-words">
                            {doc.title || t('appointment_detail.doc_label')}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 break-words">
                            {typeLabels[doc.type] || doc.type}
                            {doc.createdAt && (
                              <> &middot; {new Date(doc.createdAt).toLocaleDateString(dateLocale)}</>
                            )}
                          </p>
                          {doc.description && (
                            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap break-words">
                              {doc.description}
                            </p>
                          )}
                        </div>
                        {fileUrl && (
                          <button
                            type="button"
                            onClick={() => downloadMedia(doc.file, doc.title || 'document')}
                            className="p-2 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors shrink-0"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Doctor Access Card */}
          <Card
            ref={accessSectionRef}
            id="access"
            tabIndex={-1}
            className="scroll-mt-24 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          >
            <CardHeader>
              <CardTitle className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-teal-600" />
                  {t('appointment_detail.access_title')}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                  preparation.accessReady ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {preparation.accessReady ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  {accessStatusLabel}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    preparation.accessReady ? 'bg-emerald-100' : 'bg-slate-100'
                  }`}>
                    {preparation.accessReady ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ShieldCheck className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {preparation.accessReady
                        ? t('appointment_detail.access_ready_title')
                        : t('appointment_detail.access_waiting_title')}
                    </p>
                    <p className="text-sm text-slate-500 mt-1 break-words">
                      {preparation.accessReady
                        ? t('appointment_detail.access_ready_desc', { name: doctorName })
                        : t('appointment_detail.access_waiting_desc', { name: doctorName })}
                    </p>
                  </div>
                </div>

                {accessError && (
                  <p className="text-sm text-rose-600">{accessError}</p>
                )}

                {canGrantAccess && (
                  <Button
                    size="sm"
                    onClick={grantDoctorAccess}
                    isLoading={isGrantingAccess}
                    leftIcon={<ShieldCheck className="w-4 h-4" />}
                  >
                    {t('appointment_detail.grant_access')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isDoctor ? t('video.patient') : t('video.doctor')}
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
                <p className="text-sm text-slate-500 mb-1">{t('appointment_detail.price_label')}</p>
                <p className="text-2xl font-bold text-slate-900">
                  {(appointment.price || appointment.doctor?.price || 0).toLocaleString(dateLocale)} ₸
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
                    {isWithinWindow ? t('appointment_detail.window_open') : t('appointment_detail.window_closed')}
                  </p>
                </div>
                <p className="text-xs text-slate-500">
                  {isWithinWindow
                    ? t('appointment_detail.window_available', { hours: hoursRemaining })
                    : t('appointment_detail.window_expired_detail', { hours: WINDOW_HOURS })}
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
