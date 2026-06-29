export const defaultPatientGuideConfig = {
  title: 'Помощь',
  subtitle: 'Короткие видео и шаги, которые помогут уверенно пользоваться личным кабинетом.',
  welcomeTitle: 'Добро пожаловать в MedConnect',
  welcomeDescription: 'Начните с этих коротких инструкций: они помогут записаться к врачу, загрузить документы и подключиться к консультации.',
  steps: [
    {
      title: 'Как пользоваться приложением',
      description: 'Главная, записи, врачи, сообщения, документы и профиль пациента.',
      videoUrl: '',
      duration: '2 мин',
      isActive: true,
    },
    {
      title: 'Как загрузить документы',
      description: 'Выберите файл, укажите тип документа и при необходимости откройте доступ врачу.',
      videoUrl: '',
      duration: '1 мин',
      isActive: true,
    },
    {
      title: 'Как пройти онлайн-консультацию',
      description: 'Где найти запись, когда появится кнопка подключения и что проверить перед звонком.',
      videoUrl: '',
      duration: '2 мин',
      isActive: true,
    },
    {
      title: 'Где смотреть документы от врача',
      description: 'Заключения и назначения врача находятся отдельно от документов, которые вы загрузили сами.',
      videoUrl: '',
      duration: '1 мин',
      isActive: true,
    },
  ],
}

export function mergePatientGuideConfig(incoming) {
  const next = {
    ...defaultPatientGuideConfig,
    ...(incoming || {}),
  }

  next.steps = Array.isArray(incoming?.steps) && incoming.steps.length > 0
    ? incoming.steps.map((step) => ({
        title: step.title || '',
        description: step.description || '',
        videoUrl: step.videoUrl || '',
        duration: step.duration || '',
        isActive: step.isActive !== false,
      }))
    : defaultPatientGuideConfig.steps

  return next
}

export function getVideoEmbedUrl(url) {
  if (!url) return ''

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.replace(/^www\./, '')

    if (hostname === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}` : ''
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const id = parsed.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
      const shortsId = parsed.pathname.match(/\/shorts\/([^/]+)/)?.[1]
      if (shortsId) return `https://www.youtube.com/embed/${shortsId}`
      const embedId = parsed.pathname.match(/\/embed\/([^/]+)/)?.[1]
      if (embedId) return `https://www.youtube.com/embed/${embedId}`
    }

    if (hostname === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id ? `https://player.vimeo.com/video/${id}` : ''
    }

    if (hostname === 'player.vimeo.com' && parsed.pathname.startsWith('/video/')) {
      return url
    }
  } catch {
    return ''
  }

  return ''
}
