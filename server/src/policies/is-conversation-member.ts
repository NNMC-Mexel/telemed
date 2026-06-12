/**
 * Policy: is-conversation-member
 * Пропускает, если текущий пользователь — участник данного conversation.
 * Admin role всегда получает доступ.
 * Manager получает доступ к чатам поддержки (type=support).
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
    status: 'published',
    populate: { users_permissions_users: { fields: ['id'] } },
  });

  if (!conversation) return false;

  // Manager bypass — только для чатов поддержки
  const isManager = user.role?.type === 'manager' || user.userRole === 'manager';
  if (isManager && (conversation as any).type === 'support') return true;

  const members = conversation.users_permissions_users || [];
  return members.some((member: any) => member.id === user.id);
};
