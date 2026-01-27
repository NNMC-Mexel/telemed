/**
 * Policy: is-timeslot-owner
 * Пропускает, если текущий пользователь — доктор-владелец time slot.
 * Admin role всегда получает доступ.
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Admin bypass
  if (user.role?.type === 'admin' || user.userRole === 'admin') return true;

  const documentId = policyContext.params?.id;
  if (!documentId) return true;

  const timeSlot = await strapi.documents('api::time-slot.time-slot').findOne({
    documentId,
    populate: { doctor: { populate: { users_permissions_user: { fields: ['id'] } } } },
  });

  if (!timeSlot) return false;

  return timeSlot.doctor?.users_permissions_user?.id === user.id;
};
