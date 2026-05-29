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

const validateFileType = (file: any) => {
  const fileName = getFileName(file);
  const ext = getFileExt(file);
  const mime = getMime(file);
  const allowedMimes = ALLOWED_UPLOAD_TYPES.get(ext);

  if (!allowedMimes || !allowedMimes.has(mime)) {
    throw new ValidationError(
      `Unsupported file type: ${fileName || 'file'}. Allowed types: PDF, JPG, PNG, WEBP, DOC, DOCX.`,
    );
  }
};

const validateUploadFiles = (ctx: any) => {
  const filesInput = ctx.request?.files?.files;
  getUploadFiles(filesInput).forEach(validateFileType);
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
