import { useEffect, useState } from 'react'
import { Loader2, RefreshCcw, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Textarea from '../../components/ui/Textarea'
import { contentAPI, normalizeResponse } from '../../services/api'

function prettyJson(value) {
  if (!value) return ''
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

function parseJsonOrThrow(rawValue, fieldName) {
  const text = (rawValue || '').trim()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Поле "${fieldName}" содержит невалидный JSON`)
  }
}

function AdminContent() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [siteName, setSiteName] = useState('')
  const [siteDescription, setSiteDescription] = useState('')
  const [aboutTitle, setAboutTitle] = useState('')
  const [aboutBody, setAboutBody] = useState('')

  const [defaultSeoJson, setDefaultSeoJson] = useState('')
  const [aboutBlocksJson, setAboutBlocksJson] = useState('')

  const [seoError, setSeoError] = useState('')
  const [blocksError, setBlocksError] = useState('')

  const loadContent = async () => {
    setIsLoading(true)
    setSeoError('')
    setBlocksError('')

    try {
      const [globalRes, aboutRes] = await Promise.all([
        contentAPI.getGlobal(),
        contentAPI.getAbout(),
      ])

      const { data: globalData } = normalizeResponse(globalRes)
      const { data: aboutData } = normalizeResponse(aboutRes)

      setSiteName(globalData?.siteName || '')
      setSiteDescription(globalData?.siteDescription || '')
      setDefaultSeoJson(prettyJson(globalData?.defaultSeo))

      setAboutTitle(aboutData?.title || '')

      const richTextBlock = (aboutData?.blocks || []).find((block) => block?.__component === 'shared.rich-text')
      setAboutBody(richTextBlock?.body || '')
      setAboutBlocksJson(prettyJson(aboutData?.blocks))
    } catch (error) {
      console.error('Error loading content:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadContent()
  }, [])

  const handleSave = async () => {
    setSeoError('')
    setBlocksError('')

    if (!siteName.trim()) {
      alert('Название сайта обязательно')
      return
    }

    if (!siteDescription.trim()) {
      alert('Описание сайта обязательно')
      return
    }

    setIsSaving(true)

    try {
      const parsedSeo = parseJsonOrThrow(defaultSeoJson, 'SEO JSON')
      const parsedBlocks = parseJsonOrThrow(aboutBlocksJson, 'About blocks JSON')

      const finalBlocks = Array.isArray(parsedBlocks) ? [...parsedBlocks] : []
      const richTextIndex = finalBlocks.findIndex((block) => block?.__component === 'shared.rich-text')

      if (aboutBody.trim()) {
        if (richTextIndex >= 0) {
          finalBlocks[richTextIndex] = {
            ...finalBlocks[richTextIndex],
            body: aboutBody,
          }
        } else {
          finalBlocks.unshift({
            __component: 'shared.rich-text',
            body: aboutBody,
          })
        }
      }

      await Promise.all([
        contentAPI.updateGlobal({
          siteName: siteName.trim(),
          siteDescription: siteDescription.trim(),
          defaultSeo: parsedSeo,
        }),
        contentAPI.updateAbout({
          title: aboutTitle.trim(),
          blocks: finalBlocks,
        }),
      ])

      await loadContent()
      alert('Контент сохранён')
    } catch (error) {
      if (error.message?.includes('SEO JSON')) {
        setSeoError(error.message)
      } else if (error.message?.includes('About blocks JSON')) {
        setBlocksError(error.message)
      } else {
        console.error('Error saving content:', error)
        alert('Не удалось сохранить контент')
      }
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
          <h1 className='text-2xl font-bold text-slate-900'>Контент сайта</h1>
          <p className='text-slate-600'>Редактирование основных блоков лендинга через Strapi</p>
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
          <CardTitle>Основной контент (Global)</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Input
            label='Название сайта'
            required
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            placeholder='Например: MedConnect'
          />
          <Textarea
            label='Описание сайта'
            required
            rows={3}
            value={siteDescription}
            onChange={(e) => setSiteDescription(e.target.value)}
            placeholder='Короткое описание для главной страницы'
          />
          <Textarea
            label='SEO JSON (defaultSeo)'
            rows={8}
            value={defaultSeoJson}
            onChange={(e) => setDefaultSeoJson(e.target.value)}
            error={seoError}
            hint='Структура: metaTitle, metaDescription, shareImage (id или объект)'
            className='font-mono text-xs'
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Блок "О нас" (About)</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Input
            label='Заголовок блока "О нас"'
            value={aboutTitle}
            onChange={(e) => setAboutTitle(e.target.value)}
            placeholder='Например: MedConnect — ваш надёжный партнёр...'
          />
          <Textarea
            label='Текст блока "О нас" (Rich text body)'
            rows={5}
            value={aboutBody}
            onChange={(e) => setAboutBody(e.target.value)}
            placeholder='Основной текст раздела "О нас"'
          />
          <Textarea
            label='About blocks JSON (расширенное редактирование)'
            rows={12}
            value={aboutBlocksJson}
            onChange={(e) => setAboutBlocksJson(e.target.value)}
            error={blocksError}
            hint='Полный массив dynamic zone blocks для single type About'
            className='font-mono text-xs'
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default AdminContent
