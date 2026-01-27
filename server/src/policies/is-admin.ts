/**
 * Policy: is-admin
 * Пропускает запрос только если у пользователя роль admin (по userRole или Strapi role type).
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Проверяем по Strapi role type
  if (user.role?.type === 'admin') return true;

  // Fallback: проверяем по кастомному полю userRole
  if (user.userRole === 'admin') return true;

  return false;
};
