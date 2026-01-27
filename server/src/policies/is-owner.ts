/**
 * Policy: is-owner
 * Универсальная проверка ownership: сущность принадлежит текущему пользователю.
 *
 * Config:
 *   - relation: имя поля-связи с User (default: "user")
 *   - uid: UID content-type (default: из route info)
 *
 * Admin role всегда получает доступ.
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Admin bypass
  if (user.role?.type === 'admin' || user.userRole === 'admin') return true;

  const documentId = policyContext.params?.id;
  if (!documentId) return true; // Для list-запросов ownership фильтруется в controller

  const uid = config?.uid || policyContext.state?.route?.info?.apiName;
  const relationField = config?.relation || 'user';

  if (!uid) return false;

  const contentTypeUid = uid.includes('::') ? uid : `api::${uid}.${uid}`;

  const entity = await strapi.documents(contentTypeUid).findOne({
    documentId,
    populate: { [relationField]: { fields: ['id'] } },
  });

  if (!entity) return false;

  const relatedUser = entity[relationField];
  return relatedUser?.id === user.id;
};
