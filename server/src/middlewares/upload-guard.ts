/**
 * Upload guard — серверная валидация всех загрузок через POST /api/upload.
 *
 * Whitelist-подход: пропускаем только изображения и документы.
 * Исполняемые и скриптовые файлы (.js, .bat, .exe, .sh, .html и т.д.)
 * отклоняются и по расширению, и по MIME-типу — клиентской проверки недостаточно.
 *
 * Видео (mp4/webm, до 60 МБ) разрешено отдельно и только администраторам —
 * оно нужно лишь для маркетинговых сторис и видеоотзывов. Для остальных ролей
 * список прежний.
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

// Video is only ever needed by admin-managed marketing content.
// It stays out of the default list so a patient account cannot be used to park
// large media on the server.
const ADMIN_ONLY_EXTENSIONS = new Set(['mp4', 'webm'])
const ADMIN_ONLY_MIME_TYPES = new Set(['video/mp4', 'video/webm'])

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_VIDEO_SIZE_BYTES = 60 * 1024 * 1024 // 60 MB

const getExtension = (filename: string): string => {
  const idx = filename.lastIndexOf('.')
  if (idx === -1 || idx === filename.length - 1) return ''
  return filename.slice(idx + 1).toLowerCase()
}

const validateFile = (file: any, isAdmin: boolean): string | null => {
  // formidable v3 (Strapi v5): originalFilename/mimetype/size; fallback на старые поля
  const name: string = file?.originalFilename || file?.name || ''
  const mime: string = (file?.mimetype || file?.type || '').toLowerCase()
  const size: number = file?.size || 0

  if (!name || name.includes('\0')) {
    return 'Invalid file name'
  }

  const ext = getExtension(name)
  const isVideo = ADMIN_ONLY_EXTENSIONS.has(ext) || ADMIN_ONLY_MIME_TYPES.has(mime)

  if (isVideo && !isAdmin) {
    return `File extension ".${ext || ''}" is not allowed`
  }

  const allowedExtensions = isAdmin
    ? new Set([...ALLOWED_EXTENSIONS, ...ADMIN_ONLY_EXTENSIONS])
    : ALLOWED_EXTENSIONS
  const allowedMimeTypes = isAdmin
    ? new Set([...ALLOWED_MIME_TYPES, ...ADMIN_ONLY_MIME_TYPES])
    : ALLOWED_MIME_TYPES

  if (!ext || !allowedExtensions.has(ext)) {
    return `File extension ".${ext || ''}" is not allowed`
  }

  if (!allowedMimeTypes.has(mime)) {
    return `File type "${mime}" is not allowed`
  }

  const maxSize = isVideo ? MAX_VIDEO_SIZE_BYTES : MAX_FILE_SIZE_BYTES
  if (size > maxSize) {
    return `File is too large (max ${Math.round(maxSize / (1024 * 1024))} MB)`
  }

  return null
}

/**
 * This middleware runs before the users-permissions auth policy, so
 * `ctx.state.user` is not populated yet. The bearer token is verified here on
 * purpose — the answer only ever widens the allow-list, and any failure falls
 * back to the strict one.
 */
const isAdminRequest = async (ctx: any, strapi: any): Promise<boolean> => {
  try {
    const header: string = ctx.request?.header?.authorization || ''
    if (!header.startsWith('Bearer ')) return false

    const { id } = await strapi
      .plugin('users-permissions')
      .service('jwt')
      .verify(header.slice(7).trim())
    if (!id) return false

    const user = await strapi
      .query('plugin::users-permissions.user')
      .findOne({ where: { id }, populate: ['role'] })

    return user?.role?.type === 'admin' && !user.blocked
  } catch {
    return false
  }
}

export default (config, { strapi }) => {
  return async (ctx, next) => {
    const isUpload =
      ctx.request.method === 'POST' &&
      (ctx.request.path === '/api/upload' || ctx.request.path === '/upload')

    if (!isUpload) return next()

    const filesField = ctx.request.files?.files
    const files = Array.isArray(filesField) ? filesField : filesField ? [filesField] : []
    if (files.length === 0) return next()

    const isAdmin = await isAdminRequest(ctx, strapi)

    for (const file of files) {
      const error = validateFile(file, isAdmin)
      if (error) {
        const name = file?.originalFilename || file?.name || 'file'
        strapi.log.warn(`upload-guard: rejected "${name}" — ${error}`)
        return ctx.badRequest(`Upload rejected: ${error}`)
      }
    }

    return next()
  }
}
