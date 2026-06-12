/**
 * Upload guard — серверная валидация всех загрузок через POST /api/upload.
 *
 * Whitelist-подход: пропускаем только изображения и документы.
 * Исполняемые и скриптовые файлы (.js, .bat, .exe, .sh, .html и т.д.)
 * отклоняются и по расширению, и по MIME-типу — клиентской проверки недостаточно.
 */

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif',
  'pdf', 'doc', 'docx', 'xls', 'xlsx',
])

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const getExtension = (filename: string): string => {
  const idx = filename.lastIndexOf('.')
  if (idx === -1 || idx === filename.length - 1) return ''
  return filename.slice(idx + 1).toLowerCase()
}

const validateFile = (file: any): string | null => {
  // formidable v3 (Strapi v5): originalFilename/mimetype/size; fallback на старые поля
  const name: string = file?.originalFilename || file?.name || ''
  const mime: string = (file?.mimetype || file?.type || '').toLowerCase()
  const size: number = file?.size || 0

  if (!name || name.includes('\0')) {
    return 'Invalid file name'
  }

  const ext = getExtension(name)
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return `File extension ".${ext || ''}" is not allowed`
  }

  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return `File type "${mime}" is not allowed`
  }

  if (size > MAX_FILE_SIZE_BYTES) {
    return 'File is too large (max 10 MB)'
  }

  return null
}

export default (config, { strapi }) => {
  return async (ctx, next) => {
    const isUpload =
      ctx.request.method === 'POST' &&
      (ctx.request.path === '/api/upload' || ctx.request.path === '/upload')

    if (!isUpload) return next()

    const filesField = ctx.request.files?.files
    const files = Array.isArray(filesField) ? filesField : filesField ? [filesField] : []

    for (const file of files) {
      const error = validateFile(file)
      if (error) {
        const name = file?.originalFilename || file?.name || 'file'
        strapi.log.warn(`upload-guard: rejected "${name}" — ${error}`)
        return ctx.badRequest(`Upload rejected: ${error}`)
      }
    }

    return next()
  }
}
