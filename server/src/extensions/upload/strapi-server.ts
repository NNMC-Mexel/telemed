import { errors } from '@strapi/utils';

const { ValidationError } = errors;

const ALLOWED_UPLOAD_TYPES = new Map<string, Set<string>>([
  ['.pdf', new Set(['application/pdf'])],
  ['.jpg', new Set(['image/jpeg'])],
  ['.jpeg', new Set(['image/jpeg'])],
  ['.png', new Set(['image/png'])],
  ['.webp', new Set(['image/webp'])],
  ['.doc', new Set(['application/msword'])],
  [
    '.docx',
    new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ],
]);

// Video is needed only by the admin-managed story reel. Kept separate from the
// list above so it is never reachable from a patient or doctor account — this
// mirrors the same restriction in the upload-guard middleware.
const ADMIN_ONLY_UPLOAD_TYPES = new Map<string, Set<string>>([
  ['.mp4', new Set(['video/mp4'])],
  ['.webm', new Set(['video/webm'])],
]);

const getUploadFiles = (filesInput: any) => {
  if (!filesInput) return [];
  return Array.isArray(filesInput) ? filesInput : [filesInput];
};

const getFileName = (file: any) =>
  String(file?.originalFilename || file?.name || file?.newFilename || '').trim();

const getFileExt = (file: any) => {
  const name = getFileName(file).toLowerCase();
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex) : '';
};

const getMime = (file: any) =>
  String(file?.mimetype || file?.mime || file?.type || '').toLowerCase().trim();

const validateFileType = (file: any, isAdmin: boolean) => {
  const fileName = getFileName(file);
  const ext = getFileExt(file);
  const mime = getMime(file);

  const allowedMimes =
    ALLOWED_UPLOAD_TYPES.get(ext) || (isAdmin ? ADMIN_ONLY_UPLOAD_TYPES.get(ext) : undefined);

  if (!allowedMimes || !allowedMimes.has(mime)) {
    const allowed = isAdmin
      ? 'PDF, JPG, PNG, WEBP, DOC, DOCX, MP4, WEBM'
      : 'PDF, JPG, PNG, WEBP, DOC, DOCX';
    throw new ValidationError(`Unsupported file type: ${fileName || 'file'}. Allowed types: ${allowed}.`);
  }
};

const validateUploadFiles = (ctx: any) => {
  // Unlike the middleware, this runs after authentication, so the role is
  // already resolved on the context.
  const isAdmin = ctx.state?.user?.role?.type === 'admin';
  const filesInput = ctx.request?.files?.files;
  getUploadFiles(filesInput).forEach((file: any) => validateFileType(file, isAdmin));
};

export default (plugin: any) => {
  const originalContentApiFactory = plugin.controllers['content-api'];

  plugin.controllers['content-api'] = (factoryContext: any) => {
    const originalController = originalContentApiFactory(factoryContext);
    const originalUpload = originalController.upload;

    return {
      ...originalController,

      async upload(ctx: any) {
        validateUploadFiles(ctx);
        return originalUpload.call(this, ctx);
      },
    };
  };

  return plugin;
};
