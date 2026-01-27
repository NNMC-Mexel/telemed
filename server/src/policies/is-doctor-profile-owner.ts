/**
 * Policy: is-doctor-profile-owner
 * Пропускает, если текущий пользователь — владелец профиля доктора.
 * Admin role всегда получает доступ.
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Admin bypass
  if (user.role?.type === 'admin' || user.userRole === 'admin') return true;

  const documentId = policyContext.params?.id;
  if (!documentId) return true;

  const doctor = await strapi.documents('api::doctor.doctor').findOne({
    documentId,
    populate: { users_permissions_user: { fields: ['id'] } },
  });

  if (!doctor) return false;

  return doctor.users_permissions_user?.id === user.id;
};
