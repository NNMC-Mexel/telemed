/**
 * Policy: is-appointment-participant
 * Пропускает, если текущий пользователь — пациент ИЛИ доктор данного appointment.
 * Admin role всегда получает доступ.
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Admin bypass
  if (user.role?.type === 'admin' || user.userRole === 'admin') return true;

  const documentId = policyContext.params?.id;
  if (!documentId) return true; // list-запросы фильтруются в controller

  const appointment = await strapi.documents('api::appointment.appointment').findOne({
    documentId,
    populate: {
      patient: { fields: ['id'] },
      doctor: { populate: { users_permissions_user: { fields: ['id'] } } },
    },
  });

  if (!appointment) return false;

  // Проверяем: текущий user = patient?
  if (appointment.patient?.id === user.id) return true;

  // Проверяем: текущий user = doctor.users_permissions_user?
  if (appointment.doctor?.users_permissions_user?.id === user.id) return true;

  return false;
};
