/**
 * Policy: is-conversation-member
 * Пропускает, если текущий пользователь — участник данного conversation.
 * Admin role всегда получает доступ.
 */
export default async (policyContext, config, { strapi }) => {
  const user = policyContext.state?.user;
  if (!user) return false;

  // Admin bypass
  if (user.role?.type === 'admin' || user.userRole === 'admin') return true;

  const documentId = policyContext.params?.id;
  if (!documentId) return true;

  const conversation = await strapi.documents('api::conversation.conversation').findOne({
    documentId,
    populate: { users_permissions_users: { fields: ['id'] } },
  });

  if (!conversation) return false;

  const members = conversation.users_permissions_users || [];
  return members.some((member: any) => member.id === user.id);
};
