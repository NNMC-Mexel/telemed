import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleHelp,
  FileText,
  Loader2,
  PlayCircle,
  Stethoscope,
  Upload,
  Video,
} from 'lucide-react'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { contentAPI, normalizeResponse } from '../../services/api'
import { getVideoEmbedUrl, mergePatientGuideConfig } from '../../utils/patientGuide'

const stepIcons = [BookOpenCheck, Upload, Video, FileText]

function PatientHelp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(true)
  const [guideConfig, setGuideConfig] = useState(() => mergePatientGuideConfig())

  const isWelcome = useMemo(() => new URLSearchParams(location.search).get('welcome') === '1', [location.search])
  const activeSteps = useMemo(
    () => guideConfig.steps.filter((step) => step.isActive !== false),
    [guideConfig.steps],
  )

  useEffect(() => {
    let isActive = true

    const loadGuide = async () => {
      setIsLoading(true)
      try {
        const response = await contentAPI.getPatientGuide()
        const { data } = normalizeResponse(response)
        if (isActive) setGuideConfig(mergePatientGuideConfig(data?.patientGuideConfig))
      } catch (error) {
        console.error('Error loading patient guide:', error)
      } finally {
        if (isActive) setIsLoading(false)
      }
    }

    loadGuide()
    return () => {
      isActive = false
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <section className="rounded-2xl bg-gradient-to-br from-teal-600 via-cyan-600 to-sky-600 px-5 py-6 text-white shadow-lg shadow-teal-600/20 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium text-white">
              <CircleHelp className="h-4 w-4" />
              {isWelcome ? guideConfig.welcomeTitle : guideConfig.title}
            </div>
            <h1 className="text-2xl font-bold sm:text-3xl">
              {isWelcome ? guideConfig.welcomeTitle : guideConfig.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50 sm:text-base">
              {isWelcome ? guideConfig.welcomeDescription : guideConfig.subtitle}
            </p>
          </div>
          {isWelcome && (
            <Button
              variant="secondary"
              className="bg-white text-teal-700 hover:bg-teal-50"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => navigate('/patient')}
            >
              {t('patient_help.go_dashboard')}
            </Button>
          )}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-4">
        {activeSteps.map((step, index) => {
          const Icon = stepIcons[index % stepIcons.length]
          return (
            <button
              key={`${step.title}-${index}`}
              className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40"
              onClick={() => document.getElementById(`guide-step-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('patient_help.step', { count: index + 1 })}
                </span>
              </div>
              <h2 className="font-semibold text-slate-900">{step.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{step.description}</p>
            </button>
          )
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {activeSteps.map((step, index) => {
          const embedUrl = getVideoEmbedUrl(step.videoUrl)
          const Icon = stepIcons[index % stepIcons.length]

          return (
            <Card key={`${step.title}-${index}`} id={`guide-step-${index}`}>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {t('patient_help.step', { count: index + 1 })}
                      </span>
                      {step.duration && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          {step.duration}
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">{step.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{step.description}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  {embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={step.title}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex aspect-video flex-col items-center justify-center px-6 text-center">
                      <PlayCircle className="mb-3 h-12 w-12 text-slate-300" />
                      <p className="text-sm font-medium text-slate-600">{t('patient_help.video_placeholder')}</p>
                      <p className="mt-1 text-xs text-slate-400">{t('patient_help.video_placeholder_desc')}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Button variant="outline" leftIcon={<Upload className="w-4 h-4" />} onClick={() => navigate('/patient/documents')}>
          {t('patient_help.open_documents')}
        </Button>
        <Button variant="outline" leftIcon={<Stethoscope className="w-4 h-4" />} onClick={() => navigate('/patient/doctors')}>
          {t('patient_help.find_doctor')}
        </Button>
        <Button variant="outline" leftIcon={<CheckCircle2 className="w-4 h-4" />} onClick={() => navigate('/patient/appointments')}>
          {t('patient_help.open_appointments')}
        </Button>
      </div>
    </div>
  )
}

export default PatientHelp
