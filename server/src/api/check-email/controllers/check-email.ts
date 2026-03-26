export default {
  async checkEmail(ctx) {
    const { email } = ctx.query;

    if (!email) {
      return ctx.badRequest('Email is required');
    }

    const user = await strapi
      .query('plugin::users-permissions.user')
      .findOne({ where: { email: email.toLowerCase().trim() } });

    ctx.body = { exists: !!user };
  },
};
