import { useEffect, useMemo, useState } from 'react'
import { Eye, FileText, Globe2, LayoutTemplate, Loader2, RefreshCcw, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import { contentAPI, normalizeResponse } from '../../services/api'

const defaultLandingConfig = {
  hero: {
    badge: 'Быстрая и удобная медицинская помощь',
    titlePrefix: 'Консультация с врачом',
    titleHighlight: 'онлайн',
    description:
      'Получите квалифицированную медицинскую помощь не выходя из дома. Наши специалисты готовы помочь вам прямо сейчас.',
    primaryButtonLabel: 'Найти врача',
    secondaryButtonLabel: 'Регистрация',
  },
  heroCard: {
    title: 'Онлайн-консультация',
    subtitle: 'Выберите удобное время',
    items: [
      {
        title: 'Опытные врачи',
        description: 'Только сертифицированные специалисты с подтверждённым опытом',
      },
      {
        title: 'Удобно и быстро',
        description: 'Консультация из любой точки мира без очередей и ожидания',
      },
      {
        title: 'Поддержка 24/7',
        description: 'Служба поддержки всегда на связи для решения ваших вопросов',
      },
    ],
    buttonLabel: 'Записаться сейчас',
  },
  stats: [
    { value: '1100+', label: 'Консультаций' },
    { value: '6+', label: 'Врачей' },
    { value: '4.9', label: 'Средний рейтинг' },
    { value: '98%', label: 'Довольных' },
  ],
  featuresSection: {
    badge: 'Почему мы',
    title: 'Почему выбирают MedConnect',
    subtitle: 'Современные технологии для вашего здоровья и комфорта',
    cards: [
      {
        title: 'Видеоконсультации',
        description: 'HD качество связи без задержек. Безопасное P2P соединение для комфортного общения.',
      },
      {
        title: 'Безопасность данных',
        description: 'Шифрование данных и соответствие стандартам медицинской безопасности.',
      },
      {
        title: 'Доступно 24/7',
        description: 'Запишитесь на удобное время или получите срочную консультацию в любой момент.',
      },
      {
        title: 'Электронные документы',
        description: 'Рецепты, заключения и направления в электронном виде сразу после консультации.',
      },
    ],
  },
  stepsSection: {
    badge: 'Как это работает',
    title: 'Всего 4 простых шага',
    subtitle: 'До консультации с врачом',
    steps: [
      {
        title: 'Выберите врача',
        description: 'Найдите специалиста по направлению, рейтингу или отзывам',
      },
      {
        title: 'Запишитесь на приём',
        description: 'Выберите удобные дату и время для консультации',
      },
      {
        title: 'Оплатите онлайн',
        description: 'Безопасная оплата через Kaspi, Halyk или картой',
      },
      {
        title: 'Получите консультацию',
        description: 'Подключитесь к видеозвонку в назначенное время',
      },
    ],
  },
  aboutSection: {
    badge: 'О нас',
    title: 'MedConnect — ваш надёжный партнёр в заботе о здоровье',
    description:
      'Мы создали современную платформу телемедицины, которая делает качественную медицинскую помощь доступной каждому.',
    bullets: [
      'Лицензированные врачи с подтверждённым опытом',
      'Безопасная и защищённая платформа',
      'Круглосуточная поддержка пациентов',
      'Электронные рецепты и документы',
    ],
    buttonLabel: 'Присоединиться',
  },
  contactSection: {
    badge: 'Контакты',
    title: 'Свяжитесь с нами',
    subtitle: 'Мы всегда на связи и готовы ответить на ваши вопросы',
    phone: {
      title: 'Телефон',
      note: 'Пн-Пт: 8:00 — 20:00, Сб: 9:00 — 15:00',
      value: '+7 (717) 270-12-34',
    },
    email: {
      title: 'Электронная почта',
      note: 'Ответим в течение 24 часов',
      value: 'info@medconnect.kz',
    },
    address: {
      title: 'Адрес',
      note: 'Приём по записи',
      value: 'г. Астана, просп. Абылай хана, 42',
    },
    quickCard: {
      title: 'Нужна быстрая консультация?',
      description:
        'Запишитесь на онлайн-консультацию с врачом прямо сейчас. Наши специалисты помогут вам в кратчайшие сроки.',
      bullets: ['Без очередей и ожидания', 'Консультация из любой точки', 'Запись результатов в личный кабинет'],
      buttonLabel: 'Записаться к врачу',
    },
    mapEmbedUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2505.5!2d71.4926513!3d51.1492038!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4245817a521995c9%3A0xe653c982ba77912!2z0J3QsNGG0LjQvtC90LDQu9GM0L3Ri9C5INC90LDRg9GH0L3Ri9C5INC80LXQtNC40YbQuNC90YHQutC40Lkg0YbQtdC90YLRgA!5e0!3m2!1sru!2skz!4v1700000000000!5m2!1sru!2skz',
  },
}

function mergeConfig(base, incoming) {
  return {
    ...base,
    ...(incoming || {}),
    hero: { ...base.hero, ...(incoming?.hero || {}) },
    heroCard: {
      ...base.heroCard,
      ...(incoming?.heroCard || {}),
      items: Array.isArray(incoming?.heroCard?.items) && incoming.heroCard.items.length > 0
        ? incoming.heroCard.items
        : base.heroCard.items,
    },
    stats: Array.isArray(incoming?.stats) && incoming.stats.length > 0 ? incoming.stats : base.stats,
    featuresSection: {
      ...base.featuresSection,
      ...(incoming?.featuresSection || {}),
      cards: Array.isArray(incoming?.featuresSection?.cards) && incoming.featuresSection.cards.length > 0
        ? incoming.featuresSection.cards
        : base.featuresSection.cards,
    },
    stepsSection: {
      ...base.stepsSection,
      ...(incoming?.stepsSection || {}),
      steps: Array.isArray(incoming?.stepsSection?.steps) && incoming.stepsSection.steps.length > 0
        ? incoming.stepsSection.steps
        : base.stepsSection.steps,
    },
    aboutSection: {
      ...base.aboutSection,
      ...(incoming?.aboutSection || {}),
      bullets: Array.isArray(incoming?.aboutSection?.bullets) && incoming.aboutSection.bullets.length > 0
        ? incoming.aboutSection.bullets
        : base.aboutSection.bullets,
    },
    contactSection: {
      ...base.contactSection,
      ...(incoming?.contactSection || {}),
      phone: { ...base.contactSection.phone, ...(incoming?.contactSection?.phone || {}) },
      email: { ...base.contactSection.email, ...(incoming?.contactSection?.email || {}) },
      address: { ...base.contactSection.address, ...(incoming?.contactSection?.address || {}) },
      quickCard: {
        ...base.contactSection.quickCard,
        ...(incoming?.contactSection?.quickCard || {}),
        bullets:
          Array.isArray(incoming?.contactSection?.quickCard?.bullets) && incoming.contactSection.quickCard.bullets.length > 0
            ? incoming.contactSection.quickCard.bullets
            : base.contactSection.quickCard.bullets,
      },
    },
  }
}

function linesToArray(value) {
  return (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function arrayToLines(value) {
  return Array.isArray(value) ? value.join('\n') : ''
}

function AdminContent() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [siteName, setSiteName] = useState('')
  const [siteDescription, setSiteDescription] = useState('')
  const [seoMetaTitle, setSeoMetaTitle] = useState('')
  const [seoMetaDescription, setSeoMetaDescription] = useState('')
  const [landingConfig, setLandingConfig] = useState(defaultLandingConfig)

  const heroCardItemsText = useMemo(
    () => landingConfig.heroCard.items.map((item) => `${item.title} | ${item.description}`).join('\n'),
    [landingConfig.heroCard.items],
  )
  const featuresCardsText = useMemo(
    () => landingConfig.featuresSection.cards.map((item) => `${item.title} | ${item.description}`).join('\n'),
    [landingConfig.featuresSection.cards],
  )
  const stepsText = useMemo(
    () => landingConfig.stepsSection.steps.map((item) => `${item.title} | ${item.description}`).join('\n'),
    [landingConfig.stepsSection.steps],
  )

  const loadContent = async () => {
    setIsLoading(true)
    try {
      const globalRes = await contentAPI.getGlobal()
      const { data: globalData } = normalizeResponse(globalRes)

      const mergedConfig = mergeConfig(defaultLandingConfig, globalData?.landingConfig || {})
      setLandingConfig(mergedConfig)

      setSiteName(globalData?.siteName || 'MedConnect')
      setSiteDescription(globalData?.siteDescription || mergedConfig.hero.description)
      setSeoMetaTitle(globalData?.defaultSeo?.metaTitle || 'MedConnect — Телемедицина')
      setSeoMetaDescription(
        globalData?.defaultSeo?.metaDescription ||
          'Онлайн-консультации с врачами MedConnect. Запись, чат, документы и поддержка 24/7.',
      )
    } catch (error) {
      console.error('Error loading content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadContent()
  }, [])

  const setConfigValue = (path, value) => {
    setLandingConfig((prev) => {
      const next = structuredClone(prev)
      let ref = next
      for (let i = 0; i < path.length - 1; i += 1) {
        ref = ref[path[i]]
      }
      ref[path[path.length - 1]] = value
      return next
    })
  }

  const parseTitleDescriptionRows = (textValue, fallbackRows) => {
    const rows = linesToArray(textValue)
    if (rows.length === 0) return fallbackRows
    return rows.map((row, index) => {
      const [titlePart, ...descriptionParts] = row.split('|')
      const title = titlePart?.trim() || fallbackRows[index]?.title || ''
      const description = descriptionParts.join('|').trim() || fallbackRows[index]?.description || ''
      return { title, description }
    })
  }

  const handleSave = async () => {
    if (!siteName.trim()) {
      alert('Название бренда обязательно')
      return
    }

    setIsSaving(true)
    try {
      await contentAPI.updateGlobal({
        siteName: siteName.trim(),
        siteDescription: siteDescription.trim() || landingConfig.hero.description,
        defaultSeo: {
          metaTitle: seoMetaTitle.trim() || 'MedConnect — Телемедицина',
          metaDescription:
            seoMetaDescription.trim() ||
            'Онлайн-консультации с врачами MedConnect. Запись, чат, документы и поддержка 24/7.',
        },
        landingConfig,
      })

      await loadContent()
      alert('Контент лендинга сохранён')
    } catch (error) {
      console.error('Error saving content:', error)
      alert('Не удалось сохранить контент')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='w-8 h-8 text-teal-600 animate-spin' />
      </div>
    )
  }

  return (
    <div className='space-y-6 animate-fadeIn'>
      <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Контент лендинга MedConnect</h1>
          <p className='text-slate-600'>Редактируются блоки главной страницы (`/`) из ваших скриншотов</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='secondary' leftIcon={<RefreshCcw className='w-4 h-4' />} onClick={loadContent}>
            Обновить
          </Button>
          <Button leftIcon={<Save className='w-4 h-4' />} onClick={handleSave} isLoading={isSaving}>
            Сохранить
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1) Hero-блок (верх экрана)</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Input
            label='Бейдж над заголовком'
            value={landingConfig.hero.badge}
            onChange={(e) => setConfigValue(['hero', 'badge'], e.target.value)}
          />
          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='Заголовок: первая часть'
              value={landingConfig.hero.titlePrefix}
              onChange={(e) => setConfigValue(['hero', 'titlePrefix'], e.target.value)}
            />
            <Input
              label='Заголовок: выделенная часть'
              value={landingConfig.hero.titleHighlight}
              onChange={(e) => setConfigValue(['hero', 'titleHighlight'], e.target.value)}
            />
          </div>
          <Textarea
            label='Описание в Hero'
            rows={3}
            value={landingConfig.hero.description}
            onChange={(e) => setConfigValue(['hero', 'description'], e.target.value)}
          />
          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='Кнопка 1'
              value={landingConfig.hero.primaryButtonLabel}
              onChange={(e) => setConfigValue(['hero', 'primaryButtonLabel'], e.target.value)}
            />
            <Input
              label='Кнопка 2'
              value={landingConfig.hero.secondaryButtonLabel}
              onChange={(e) => setConfigValue(['hero', 'secondaryButtonLabel'], e.target.value)}
            />
          </div>
          <div className='rounded-xl border border-dashed border-teal-300 bg-teal-50 p-4'>
            <div className='flex items-center gap-2 text-sm font-medium text-teal-800 mb-2'>
              <Eye className='w-4 h-4' />
              Превью текста Hero
            </div>
            <p className='text-slate-800 font-semibold'>{landingConfig.hero.badge}</p>
            <p className='text-slate-900 text-lg mt-1'>
              {landingConfig.hero.titlePrefix} <span className='text-teal-600'>{landingConfig.hero.titleHighlight}</span>
            </p>
            <p className='text-slate-700 mt-1'>{landingConfig.hero.description}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Карточка справа в Hero + метрики</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='Заголовок карточки'
              value={landingConfig.heroCard.title}
              onChange={(e) => setConfigValue(['heroCard', 'title'], e.target.value)}
            />
            <Input
              label='Подзаголовок карточки'
              value={landingConfig.heroCard.subtitle}
              onChange={(e) => setConfigValue(['heroCard', 'subtitle'], e.target.value)}
            />
          </div>
          <Textarea
            label='Пункты карточки (каждая строка: Заголовок | Описание)'
            rows={4}
            value={heroCardItemsText}
            onChange={(e) =>
              setConfigValue(
                ['heroCard', 'items'],
                parseTitleDescriptionRows(e.target.value, landingConfig.heroCard.items).slice(0, 3),
              )
            }
          />
          <Input
            label='Кнопка карточки'
            value={landingConfig.heroCard.buttonLabel}
            onChange={(e) => setConfigValue(['heroCard', 'buttonLabel'], e.target.value)}
          />
          <div className='grid md:grid-cols-2 lg:grid-cols-4 gap-4'>
            {landingConfig.stats.map((item, index) => (
              <div key={index} className='space-y-2 p-3 rounded-xl border border-slate-200'>
                <Input
                  label={`Метрика ${index + 1}: значение`}
                  value={item.value}
                  onChange={(e) => {
                    const next = [...landingConfig.stats]
                    next[index] = { ...next[index], value: e.target.value }
                    setConfigValue(['stats'], next)
                  }}
                />
                <Input
                  label={`Метрика ${index + 1}: подпись`}
                  value={item.label}
                  onChange={(e) => {
                    const next = [...landingConfig.stats]
                    next[index] = { ...next[index], label: e.target.value }
                    setConfigValue(['stats'], next)
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3) Блок “Почему мы”</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label='Бейдж'
              value={landingConfig.featuresSection.badge}
              onChange={(e) => setConfigValue(['featuresSection', 'badge'], e.target.value)}
            />
            <Input
              label='Заголовок'
              value={landingConfig.featuresSection.title}
              onChange={(e) => setConfigValue(['featuresSection', 'title'], e.target.value)}
            />
            <Input
              label='Подзаголовок'
              value={landingConfig.featuresSection.subtitle}
              onChange={(e) => setConfigValue(['featuresSection', 'subtitle'], e.target.value)}
            />
          </div>
          <Textarea
            label='Карточки (каждая строка: Заголовок | Описание)'
            rows={6}
            value={featuresCardsText}
            onChange={(e) =>
              setConfigValue(
                ['featuresSection', 'cards'],
                parseTitleDescriptionRows(e.target.value, landingConfig.featuresSection.cards).slice(0, 4),
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4) Блок “Как это работает”</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label='Бейдж'
              value={landingConfig.stepsSection.badge}
              onChange={(e) => setConfigValue(['stepsSection', 'badge'], e.target.value)}
            />
            <Input
              label='Заголовок'
              value={landingConfig.stepsSection.title}
              onChange={(e) => setConfigValue(['stepsSection', 'title'], e.target.value)}
            />
            <Input
              label='Подзаголовок'
              value={landingConfig.stepsSection.subtitle}
              onChange={(e) => setConfigValue(['stepsSection', 'subtitle'], e.target.value)}
            />
          </div>
          <Textarea
            label='Шаги (каждая строка: Заголовок | Описание)'
            rows={6}
            value={stepsText}
            onChange={(e) =>
              setConfigValue(
                ['stepsSection', 'steps'],
                parseTitleDescriptionRows(e.target.value, landingConfig.stepsSection.steps).slice(0, 4),
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5) Блок “О нас”</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label='Бейдж'
              value={landingConfig.aboutSection.badge}
              onChange={(e) => setConfigValue(['aboutSection', 'badge'], e.target.value)}
            />
            <Input
              label='Заголовок'
              value={landingConfig.aboutSection.title}
              onChange={(e) => setConfigValue(['aboutSection', 'title'], e.target.value)}
            />
            <Input
              label='Кнопка'
              value={landingConfig.aboutSection.buttonLabel}
              onChange={(e) => setConfigValue(['aboutSection', 'buttonLabel'], e.target.value)}
            />
          </div>
          <Textarea
            label='Описание'
            rows={4}
            value={landingConfig.aboutSection.description}
            onChange={(e) => setConfigValue(['aboutSection', 'description'], e.target.value)}
          />
          <Textarea
            label='Пункты списка (по одному на строку)'
            rows={4}
            value={arrayToLines(landingConfig.aboutSection.bullets)}
            onChange={(e) => setConfigValue(['aboutSection', 'bullets'], linesToArray(e.target.value))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>6) Блок “Контакты”</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid md:grid-cols-3 gap-4'>
            <Input
              label='Бейдж'
              value={landingConfig.contactSection.badge}
              onChange={(e) => setConfigValue(['contactSection', 'badge'], e.target.value)}
            />
            <Input
              label='Заголовок'
              value={landingConfig.contactSection.title}
              onChange={(e) => setConfigValue(['contactSection', 'title'], e.target.value)}
            />
            <Input
              label='Подзаголовок'
              value={landingConfig.contactSection.subtitle}
              onChange={(e) => setConfigValue(['contactSection', 'subtitle'], e.target.value)}
            />
          </div>

          <div className='grid lg:grid-cols-3 gap-4'>
            <div className='space-y-2 p-3 rounded-xl border border-slate-200'>
              <h3 className='text-sm font-medium text-slate-700'>Телефон</h3>
              <Input
                label='Заголовок'
                value={landingConfig.contactSection.phone.title}
                onChange={(e) => setConfigValue(['contactSection', 'phone', 'title'], e.target.value)}
              />
              <Input
                label='Подпись'
                value={landingConfig.contactSection.phone.note}
                onChange={(e) => setConfigValue(['contactSection', 'phone', 'note'], e.target.value)}
              />
              <Input
                label='Значение'
                value={landingConfig.contactSection.phone.value}
                onChange={(e) => setConfigValue(['contactSection', 'phone', 'value'], e.target.value)}
              />
            </div>
            <div className='space-y-2 p-3 rounded-xl border border-slate-200'>
              <h3 className='text-sm font-medium text-slate-700'>Email</h3>
              <Input
                label='Заголовок'
                value={landingConfig.contactSection.email.title}
                onChange={(e) => setConfigValue(['contactSection', 'email', 'title'], e.target.value)}
              />
              <Input
                label='Подпись'
                value={landingConfig.contactSection.email.note}
                onChange={(e) => setConfigValue(['contactSection', 'email', 'note'], e.target.value)}
              />
              <Input
                label='Значение'
                value={landingConfig.contactSection.email.value}
                onChange={(e) => setConfigValue(['contactSection', 'email', 'value'], e.target.value)}
              />
            </div>
            <div className='space-y-2 p-3 rounded-xl border border-slate-200'>
              <h3 className='text-sm font-medium text-slate-700'>Адрес</h3>
              <Input
                label='Заголовок'
                value={landingConfig.contactSection.address.title}
                onChange={(e) => setConfigValue(['contactSection', 'address', 'title'], e.target.value)}
              />
              <Input
                label='Подпись'
                value={landingConfig.contactSection.address.note}
                onChange={(e) => setConfigValue(['contactSection', 'address', 'note'], e.target.value)}
              />
              <Input
                label='Значение'
                value={landingConfig.contactSection.address.value}
                onChange={(e) => setConfigValue(['contactSection', 'address', 'value'], e.target.value)}
              />
            </div>
          </div>

          <div className='space-y-3 p-4 rounded-xl border border-slate-200'>
            <h3 className='font-medium text-slate-800'>Правая CTA-карточка в блоке контактов</h3>
            <Input
              label='Заголовок'
              value={landingConfig.contactSection.quickCard.title}
              onChange={(e) => setConfigValue(['contactSection', 'quickCard', 'title'], e.target.value)}
            />
            <Textarea
              label='Описание'
              rows={3}
              value={landingConfig.contactSection.quickCard.description}
              onChange={(e) => setConfigValue(['contactSection', 'quickCard', 'description'], e.target.value)}
            />
            <Textarea
              label='Пункты (по одному на строку)'
              rows={3}
              value={arrayToLines(landingConfig.contactSection.quickCard.bullets)}
              onChange={(e) => setConfigValue(['contactSection', 'quickCard', 'bullets'], linesToArray(e.target.value))}
            />
            <Input
              label='Текст кнопки'
              value={landingConfig.contactSection.quickCard.buttonLabel}
              onChange={(e) => setConfigValue(['contactSection', 'quickCard', 'buttonLabel'], e.target.value)}
            />
            <Input
              label='Ссылка карты (Google Maps embed URL)'
              value={landingConfig.contactSection.mapEmbedUrl}
              onChange={(e) => setConfigValue(['contactSection', 'mapEmbedUrl'], e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>SEO и системные поля</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid md:grid-cols-2 gap-4'>
            <Input
              label='Название сайта (siteName)'
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
            <Input
              label='Описание сайта (siteDescription)'
              value={siteDescription}
              onChange={(e) => setSiteDescription(e.target.value)}
            />
          </div>
          <Input
            label='SEO title'
            value={seoMetaTitle}
            onChange={(e) => setSeoMetaTitle(e.target.value)}
          />
          <Textarea
            label='SEO description'
            rows={3}
            value={seoMetaDescription}
            onChange={(e) => setSeoMetaDescription(e.target.value)}
          />
          <div className='rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4'>
            <div className='flex items-center gap-2 text-sm font-medium text-slate-700 mb-2'>
              <FileText className='w-4 h-4' />
              Сохранение
            </div>
            <p className='text-sm text-slate-600'>
              Все поля этой страницы сохраняются в `Global.landingConfig` и сразу используются на лендинге.
            </p>
            <p className='text-sm text-slate-600 mt-1'>
              Для применения на сервере перезапускать фронт не нужно, достаточно обновить страницу сайта.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Быстрое превью ключевых заголовков</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid md:grid-cols-2 gap-4'>
            <div className='p-4 rounded-xl border border-slate-200 bg-slate-50'>
              <div className='flex items-center gap-2 text-slate-800 font-medium mb-2'>
                <LayoutTemplate className='w-4 h-4 text-teal-600' />
                Hero
              </div>
              <p className='text-sm text-slate-600'>{landingConfig.hero.badge}</p>
              <p className='text-lg font-semibold text-slate-900 mt-1'>
                {landingConfig.hero.titlePrefix} {landingConfig.hero.titleHighlight}
              </p>
            </div>
            <div className='p-4 rounded-xl border border-slate-200 bg-slate-50'>
              <div className='flex items-center gap-2 text-slate-800 font-medium mb-2'>
                <Globe2 className='w-4 h-4 text-teal-600' />
                Контакты
              </div>
              <p className='text-sm text-slate-600'>{landingConfig.contactSection.title}</p>
              <p className='text-sm text-slate-900 mt-1'>{landingConfig.contactSection.phone.value}</p>
              <p className='text-sm text-slate-900'>{landingConfig.contactSection.email.value}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminContent
