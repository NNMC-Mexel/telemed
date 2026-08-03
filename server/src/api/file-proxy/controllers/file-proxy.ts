import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const SAFE_PUBLIC_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

// Media attached to these content-type fields is site content (marketing,
// editorial, public catalogue), so it must render in plain <img>/<video> tags
// that cannot send an Authorization header. Everything else — medical
// documents, chat attachments, user avatars — stays behind the token check.
const PUBLIC_MEDIA_FIELDS: Record<string, string[]> = {
  'api::story.story': ['poster', 'media'],
  'api::news-post.news-post': ['cover', 'video'],
  'api::video-testimonial.video-testimonial': ['poster', 'video'],
  'api::specialization.specialization': ['image'],
  'api::promotion.promotion': ['image', 'cover'],
  'api::article.article': ['cover'],
  'api::author.author': ['avatar'],
  'api::global.global': ['favicon'],
  'shared.media': ['file'],
  'shared.slider': ['files'],
  'shared.seo': ['shareImage'],
};

const getBearerToken = (ctx: any) => {
  const header = String(ctx.request?.headers?.authorization || '');
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
};

const getDownloadFileName = (file: any, key: string) => {
  const fallback = key.split('/').pop() || 'download';
  const name = String(file?.name || fallback)
    .replace(/[\r\n"]/g, '')
    .replace(/[\\/]/g, '_')
    .trim();

  return name || 'download';
};

const getUserFromRequest = async (ctx: any) => {
  const token = getBearerToken(ctx);
  if (!token) return null;

  try {
    const payload = await strapi.plugin('users-permissions').service('jwt').verify(token);
    if (!payload?.id) return null;

    return strapi.query('plugin::users-permissions.user').findOne({
      where: { id: payload.id },
      populate: { role: true },
    });
  } catch {
    return null;
  }
};

const getS3Client = () =>
  new S3Client({
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY!,
      secretAccessKey: process.env.MINIO_SECRET_KEY!,
    },
    region: 'us-east-1',
    endpoint: process.env.MINIO_ENDPOINT,
    forcePathStyle: true,
  });

const RESPONSIVE_FORMAT_PREFIXES = ['thumbnail_', 'small_', 'medium_', 'large_'];

const getResponsiveOriginalKey = (key: string) => {
  const normalizedKey = key.replace(/^\/+/, '');
  const lastSlashIndex = normalizedKey.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? normalizedKey.slice(0, lastSlashIndex + 1) : '';
  const fileName = normalizedKey.slice(lastSlashIndex + 1);
  const prefix = RESPONSIVE_FORMAT_PREFIXES.find((candidate) => fileName.startsWith(candidate));

  return prefix ? `${directory}${fileName.slice(prefix.length)}` : null;
};

const getFileProxyKey = (url: unknown) => {
  if (typeof url !== 'string' || !url.trim()) return null;

  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    const proxyPrefix = '/api/file-proxy/';
    const rawKey = pathname.includes(proxyPrefix)
      ? pathname.slice(pathname.indexOf(proxyPrefix) + proxyPrefix.length)
      : pathname.replace(/^\/+/, '');

    try {
      return decodeURIComponent(rawKey);
    } catch {
      return rawKey;
    }
  } catch {
    return null;
  }
};

const fileContainsResponsiveFormat = (file: any, key: string) => {
  const formats = file?.formats;
  if (!formats || typeof formats !== 'object') return false;

  const normalizedKey = key.replace(/^\/+/, '');
  return Object.values(formats).some(
    (format: any) => getFileProxyKey(format?.url) === normalizedKey,
  );
};

const findUploadFileByOriginalKey = async (key: string) => {
  const normalizedKey = key.replace(/^\/+/, '');
  const encodedKey = encodeURIComponent(normalizedKey);
  const candidateUrls = [
    `/api/file-proxy/${normalizedKey}`,
    `/api/file-proxy/${encodedKey}`,
    normalizedKey,
  ];

  const exactMatch = await strapi.db.query('plugin::upload.file').findOne({
    where: { url: { $in: candidateUrls } },
  });
  if (exactMatch) return exactMatch;

  const byUrlSuffix = await strapi.db.query('plugin::upload.file').findMany({
    where: { url: { $contains: normalizedKey } },
    limit: 5,
  });

  return byUrlSuffix?.[0] || null;
};

const findUploadFile = async (key: string) => {
  const exactFile = await findUploadFileByOriginalKey(key);
  if (exactFile) return exactFile;

  // Strapi stores responsive variants (small/medium/large/thumbnail) inside
  // the parent upload.file `formats` JSON instead of creating separate rows.
  // Resolve the parent record so public-photo authorization still applies,
  // then verify that the requested variant is really declared on that file.
  const originalKey = getResponsiveOriginalKey(key);
  if (!originalKey) return null;

  const parentFile = await findUploadFileByOriginalKey(originalKey);
  return parentFile && fileContainsResponsiveFormat(parentFile, key) ? parentFile : null;
};

const canAccessMedicalFile = async (user: any, file: any) => {
  if (!file?.id) return false;
  if (user?.role?.type === 'admin' || user?.userRole === 'admin') return true;

  const docs = await strapi.documents('api::medical-document.medical-document').findMany({
    filters: { file: { id: file.id } },
    populate: {
      user: { fields: ['id'] },
      doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
      sharedWithDoctors: { populate: { users_permissions_user: { fields: ['id'] } } },
    },
    limit: 20,
  });

  if (!docs.length) return false;

  return docs.some((doc: any) => {
    if (doc.user?.id === user?.id) return true;
    if (doc.doctor?.users_permissions_user?.id === user?.id) return true;
    return (doc.sharedWithDoctors || []).some(
      (doctor: any) => doctor?.users_permissions_user?.id === user?.id,
    );
  });
};

const isPublicDoctorPhoto = async (file: any) => {
  if (!file?.id) return false;

  const doctors = await strapi.documents('api::doctor.doctor').findMany({
    filters: {
      photo: { id: file.id },
      isActive: true,
    },
    fields: ['id'],
    limit: 1,
  });

  return doctors.length > 0;
};

const isSafePublicImage = (file: any) =>
  SAFE_PUBLIC_MIMES.has(String(file?.mime || '').toLowerCase());

// Strapi keeps every media link in the `files_related_mph` morph table, so one
// query tells us every place a file is used. A file counts as public only when
// *all* of its links are public site fields — a file reused by a medical
// document stays private even if it is also referenced by an article.
const isPublicSiteMedia = async (file: any) => {
  if (!file?.id) return false;

  try {
    const relations = await strapi.db
      .connection('files_related_mph')
      .select('related_type', 'field')
      .where('file_id', file.id);

    if (!relations?.length) return false;

    return relations.every((relation: any) =>
      (PUBLIC_MEDIA_FIELDS[relation.related_type] || []).includes(relation.field),
    );
  } catch {
    return false;
  }
};

const canAccessUserAvatar = async (user: any, file: any) => {
  if (!file?.id || !user?.id) return false;
  if (user?.role?.type === 'admin' || user?.userRole === 'admin') return true;

  const owner = await strapi.query('plugin::users-permissions.user').findOne({
    where: { id: user.id },
    populate: { avatar: true },
  });

  return owner?.avatar?.id === file.id;
};

export default {
  async proxy(ctx) {
    const key = String(ctx.params?.key || '').replace(/^\/+/, '');

    if (!process.env.MINIO_ENDPOINT) {
      ctx.status = 404;
      ctx.body = { error: 'Storage not configured' };
      return;
    }

    try {
      const file = await findUploadFile(key);
      if (!file) {
        ctx.status = 404;
        ctx.body = { error: 'File not found' };
        return;
      }

      const publicMedia =
        isSafePublicImage(file) &&
        ((await isPublicDoctorPhoto(file)) || (await isPublicSiteMedia(file)));
      if (!publicMedia) {
        const user = await getUserFromRequest(ctx);
        if (!user) {
          ctx.status = 401;
          ctx.body = { error: 'Authentication required' };
          return;
        }

        const allowed =
          (await canAccessMedicalFile(user, file)) ||
          (await canAccessUserAvatar(user, file));
        if (!allowed) {
          ctx.status = 403;
          ctx.body = { error: 'Access denied' };
          return;
        }
      }

      const s3 = getS3Client();
      // Safari (iOS especially) refuses to play a video that does not answer
      // byte-range requests, so the range header is passed straight through.
      const rangeHeader = String(ctx.request?.headers?.range || '') || undefined;
      const command = new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: key,
        Range: rangeHeader,
      });

      const response = await s3.send(command);

      ctx.set('X-Content-Type-Options', 'nosniff');
      ctx.set('Accept-Ranges', 'bytes');

      if (publicMedia) {
        ctx.set('Content-Type', response.ContentType || 'application/octet-stream');
      } else {
        ctx.set('Content-Type', 'application/octet-stream');
        ctx.set('Content-Disposition', `attachment; filename="${getDownloadFileName(file, key)}"`);
      }
      if (response.ContentLength) {
        ctx.set('Content-Length', String(response.ContentLength));
      }
      if (response.ContentRange) {
        ctx.set('Content-Range', response.ContentRange);
        ctx.status = 206;
      }
      ctx.set('Cache-Control', publicMedia ? 'public, max-age=86400' : 'private, no-store');

      ctx.body = response.Body as any;
    } catch {
      ctx.status = 404;
      ctx.body = { error: 'File not found' };
    }
  },
};
