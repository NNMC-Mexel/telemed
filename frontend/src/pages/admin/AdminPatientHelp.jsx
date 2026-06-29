import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, Loader2, Plus, RefreshCcw, Save, Trash2, Video } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import { contentAPI, normalizeResponse } from '../../services/api'
import { getVideoEmbedUrl, mergePatientGuideConfig } from '../../utils/patientGuide'

function createEmptyStep() {
  return {
    title: '',
    description: '',
    videoUrl: '',
    duration: '',
    isActive: true,
  }
}

function AdminPatientHelp() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [guideConfig, setGuideConfig] = useState(() => mergePatientGuideConfig())

  const loadGuide = async () => {
    setIsLoading(true)
    try {
      const response = await contentAPI.getGlobal()
      const { data } = normalizeResponse(response)
      setGuideConfig(mergePatientGuideConfig(data?.patientGuideConfig))
    } catch (error) {
      console.error('Error loading patient guide:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadGuide()
  }, [])

  const setConfigValue = (key, value) => {
    setGuideConfig((prev) => ({ ...prev, [key]: value }))
  }

  const setStepValue = (index, key, value) => {
    setGuideConfig((prev) => ({
      ...prev,
      steps: prev.steps.map((step, currentIndex) => (
        currentIndex === index ? { ...step, [key]: value } : step
      )),
    }))
  }

  const addStep = () => {
    setGuideConfig((prev) => ({ ...prev, steps: [...prev.steps, createEmptyStep()] }))
  }

  const removeStep = (index) => {
    setGuideConfig((prev) => ({ ...prev, steps: prev.steps.filter((_, currentIndex) => currentIndex !== index) }))
  }

  const handleSave = async () => {
    if (!guideConfig.title.trim()) {
      alert(t('admin_patient_help.err_title'))
      return
    }

    const activeSteps = guideConfig.steps.filter((step) => step.isActive !== false)
    if (activeSteps.some((step) => !step.title.trim())) {
      alert(t('admin_patient_help.err_step_title'))
      return
    }

    setIsSaving(true)
    try {
      await contentAPI.updateGlobal({
        patientGuideConfig: {
          ...guideConfig,
          title: guideConfig.title.trim(),
          subtitle: guideConfig.subtitle.trim(),
          welcomeTitle: guideConfig.welcomeTitle.trim(),
          welcomeDescription: guideConfig.welcomeDescription.trim(),
          steps: guideConfig.steps.map((step) => ({
            ...step,
            title: step.title.trim(),
            description: step.description.trim(),
            videoUrl: step.videoUrl.trim(),
            duration: step.duration.trim(),
          })),
        },
      })
      await loadGuide()
      alert(t('admin_patient_help.saved'))
    } catch (error) {
      console.error('Error saving patient guide:', error)
      alert(t('admin_patient_help.err_save'))
    } finally {
      setIsSaving(false)
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('admin_patient_help.title')}</h1>
          <p className="text-slate-600">{t('admin_patient_help.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leftIcon={<RefreshCcw className="w-4 h-4" />} onClick={loadGuide}>
            {t('common.reset')}
          </Button>
          <Button leftIcon={<Save className="w-4 h-4" />} onClick={handleSave} isLoading={isSaving}>
            {t('common.save')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin_patient_help.general')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label={t('admin_patient_help.patient_tab_name')}
              value={guideConfig.title}
              onChange={(e) => setConfigValue('title', e.target.value)}
              required
            />
            <Input
              label={t('admin_patient_help.welcome_title')}
              value={guideConfig.welcomeTitle}
              onChange={(e) => setConfigValue('welcomeTitle', e.target.value)}
            />
          </div>
          <Textarea
            label={t('admin_patient_help.patient_subtitle')}
            rows={3}
            value={guideConfig.subtitle}
            onChange={(e) => setConfigValue('subtitle', e.target.value)}
          />
          <Textarea
            label={t('admin_patient_help.welcome_desc')}
            rows={3}
            value={guideConfig.welcomeDescription}
            onChange={(e) => setConfigValue('welcomeDescription', e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{t('admin_patient_help.steps_title')}</h2>
          <p className="text-sm text-slate-500">{t('admin_patient_help.steps_hint')}</p>
        </div>
        <Button variant="outline" leftIcon={<Plus className="w-4 h-4" />} onClick={addStep}>
          {t('admin_patient_help.add_step')}
        </Button>
      </div>

      <div className="space-y-4">
        {guideConfig.steps.map((step, index) => {
          const embedUrl = getVideoEmbedUrl(step.videoUrl)

          return (
            <Card key={index}>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-sm font-bold text-teal-700">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {step.title || t('admin_patient_help.untitled_step')}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {step.isActive ? t('admin_patient_help.active') : t('admin_patient_help.hidden')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={step.isActive !== false}
                        onChange={(e) => setStepValue(index, 'isActive', e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      {t('admin_patient_help.show_step')}
                    </label>
                    <Button
                      variant="danger"
                      size="icon"
                      onClick={() => removeStep(index)}
                      disabled={guideConfig.steps.length <= 1}
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr,10rem]">
                  <Input
                    label={t('admin_patient_help.step_title')}
                    value={step.title}
                    onChange={(e) => setStepValue(index, 'title', e.target.value)}
                    required={step.isActive !== false}
                  />
                  <Input
                    label={t('admin_patient_help.duration')}
                    value={step.duration}
                    onChange={(e) => setStepValue(index, 'duration', e.target.value)}
                    placeholder="2 мин"
                  />
                </div>
                <Textarea
                  label={t('admin_patient_help.step_desc')}
                  rows={3}
                  value={step.description}
                  onChange={(e) => setStepValue(index, 'description', e.target.value)}
                />
                <Input
                  label={t('admin_patient_help.video_url')}
                  value={step.videoUrl}
                  onChange={(e) => setStepValue(index, 'videoUrl', e.target.value)}
                  placeholder="https://youtu.be/..."
                  leftIcon={<Video className="w-5 h-5" />}
                />

                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Eye className="h-4 w-4 text-teal-600" />
                    {t('admin_patient_help.preview')}
                  </div>
                  {embedUrl ? (
                    <p className="text-sm text-emerald-700">{t('admin_patient_help.video_ok')}</p>
                  ) : (
                    <p className="text-sm text-slate-500">{t('admin_patient_help.video_empty')}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default AdminPatientHelp
