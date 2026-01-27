/**
 * Policy: is-medical-document-participant
 * Пропускает, если текущий пользователь — владелец документа (patient)
 * ИЛИ доктор, связанный с документом.
 * Admin role всегда получает доступ.
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Admin bypass
  if (user.role?.type === 'admin' || user.userRole === 'admin') return true;

  const documentId = policyContext.params?.id;
  if (!documentId) return true;

  const medDoc = await strapi.documents('api::medical-document.medical-document').findOne({
    documentId,
    populate: {
      user: { fields: ['id'] },
      doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
    },
  });

  if (!medDoc) return false;

  // Пациент — владелец документа
  if (medDoc.user?.id === user.id) return true;

  // Доктор, привязанный к документу
  if (medDoc.doctor?.users_permissions_user?.id === user.id) return true;

  return false;
};
