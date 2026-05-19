import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

const getBearerToken = (ctx: any) => {
  const header = String(ctx.request?.headers?.authorization || '');
  if (header.startsWith('Bearer ')) return header.slice(7);
  const queryToken = ctx.query?.token;
  return typeof queryToken === 'string' && queryToken.trim() ? queryToken.trim() : null;
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

const findUploadFile = async (key: string) => {
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

      const publicDoctorPhoto = await isPublicDoctorPhoto(file);
      if (!publicDoctorPhoto) {
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
      const command = new GetObjectCommand({
        Bucket: process.env.MINIO_BUCKET,
        Key: key,
      });

      const response = await s3.send(command);

      ctx.set('Content-Type', response.ContentType || 'application/octet-stream');
      if (response.ContentLength) {
        ctx.set('Content-Length', String(response.ContentLength));
      }
      ctx.set(
        'Cache-Control',
        publicDoctorPhoto ? 'public, max-age=86400' : 'private, no-store',
      );

      ctx.body = response.Body as any;
    } catch {
      ctx.status = 404;
      ctx.body = { error: 'File not found' };
    }
  },
};
