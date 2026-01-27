'use strict';

/**
 * Настройка прав доступа для всех ролей: patient, doctor, admin, authenticated, public.
 * Запуск: node scripts/fix-permissions.js
 */

const rolePermissions = {
  patient: [
    'api::doctor.doctor.find',
    'api::doctor.doctor.findOne',
    'api::specialization.specialization.find',
    'api::specialization.specialization.findOne',
    'api::appointment.appointment.find',
    'api::appointment.appointment.findOne',
    'api::appointment.appointment.create',
    'api::appointment.appointment.update',
    'api::review.review.find',
    'api::review.review.findOne',
    'api::review.review.create',
    'api::time-slot.time-slot.find',
    'api::time-slot.time-slot.findOne',
    'api::message.message.find',
    'api::message.message.findOne',
    'api::message.message.create',
    'api::conversation.conversation.find',
    'api::conversation.conversation.findOne',
    'api::conversation.conversation.create',
    'api::medical-document.medical-document.find',
    'api::medical-document.medical-document.findOne',
    'api::medical-document.medical-document.create',
    'plugin::upload.content-api.upload',
    'plugin::upload.content-api.find',
    'plugin::upload.content-api.findOne',
    'plugin::users-permissions.user.me',
  ],
  doctor: [
    'api::doctor.doctor.find',
    'api::doctor.doctor.findOne',
    'api::doctor.doctor.update',
    'api::specialization.specialization.find',
    'api::specialization.specialization.findOne',
    'api::appointment.appointment.find',
    'api::appointment.appointment.findOne',
    'api::appointment.appointment.update',
    'api::review.review.find',
    'api::review.review.findOne',
    'api::time-slot.time-slot.find',
    'api::time-slot.time-slot.findOne',
    'api::time-slot.time-slot.create',
    'api::time-slot.time-slot.update',
    'api::time-slot.time-slot.delete',
    'api::message.message.find',
    'api::message.message.findOne',
    'api::message.message.create',
    'api::conversation.conversation.find',
    'api::conversation.conversation.findOne',
    'api::conversation.conversation.create',
    'api::medical-document.medical-document.find',
    'api::medical-document.medical-document.findOne',
    'api::medical-document.medical-document.create',
    'api::medical-document.medical-document.update',
    'plugin::upload.content-api.upload',
    'plugin::upload.content-api.find',
    'plugin::upload.content-api.findOne',
    'plugin::users-permissions.user.me',
  ],
  admin: [
    'api::doctor.doctor.find',
    'api::doctor.doctor.findOne',
    'api::doctor.doctor.create',
    'api::doctor.doctor.update',
    'api::doctor.doctor.delete',
    'api::specialization.specialization.find',
    'api::specialization.specialization.findOne',
    'api::specialization.specialization.create',
    'api::specialization.specialization.update',
    'api::specialization.specialization.delete',
    'api::appointment.appointment.find',
    'api::appointment.appointment.findOne',
    'api::appointment.appointment.create',
    'api::appointment.appointment.update',
    'api::appointment.appointment.delete',
    'api::review.review.find',
    'api::review.review.findOne',
    'api::review.review.create',
    'api::review.review.update',
    'api::review.review.delete',
    'api::time-slot.time-slot.find',
    'api::time-slot.time-slot.findOne',
    'api::time-slot.time-slot.create',
    'api::time-slot.time-slot.update',
    'api::time-slot.time-slot.delete',
    'api::message.message.find',
    'api::message.message.findOne',
    'api::message.message.create',
    'api::message.message.update',
    'api::message.message.delete',
    'api::conversation.conversation.find',
    'api::conversation.conversation.findOne',
    'api::conversation.conversation.create',
    'api::conversation.conversation.update',
    'api::conversation.conversation.delete',
    'api::medical-document.medical-document.find',
    'api::medical-document.medical-document.findOne',
    'api::medical-document.medical-document.create',
    'api::medical-document.medical-document.update',
    'api::medical-document.medical-document.delete',
    'api::article.article.find',
    'api::article.article.findOne',
    'api::article.article.create',
    'api::article.article.update',
    'api::article.article.delete',
    'plugin::upload.content-api.upload',
    'plugin::upload.content-api.find',
    'plugin::upload.content-api.findOne',
    'plugin::upload.content-api.destroy',
    'plugin::users-permissions.user.me',
  ],
  authenticated: [
    'api::doctor.doctor.find',
    'api::doctor.doctor.findOne',
    'api::specialization.specialization.find',
    'api::specialization.specialization.findOne',
    'api::review.review.find',
    'api::time-slot.time-slot.find',
    'api::time-slot.time-slot.findOne',
    'plugin::users-permissions.user.me',
  ],
  public: [
    'api::doctor.doctor.find',
    'api::doctor.doctor.findOne',
    'api::specialization.specialization.find',
    'api::specialization.specialization.findOne',
    'api::review.review.find',
    'api::time-slot.time-slot.find',
  ],
};

async function fixPermissions() {
  console.log('=== Настройка прав доступа для всех ролей ===\n');

  const roles = await strapi.query('plugin::users-permissions.role').findMany();

  for (const [roleType, permissions] of Object.entries(rolePermissions)) {
    const role = roles.find(r => r.type === roleType);

    if (!role) {
      console.log(`  [SKIP] Роль "${roleType}" не найдена. Запустите bootstrap для создания.`);
      continue;
    }

    console.log(`Роль: ${role.name} (type=${roleType}, id=${role.id})`);

    // Удаляем все текущие permissions
    const currentPerms = await strapi
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: role.id } });

    for (const perm of currentPerms) {
      await strapi.query('plugin::users-permissions.permission').delete({
        where: { id: perm.id },
      });
    }
    console.log(`  Удалено ${currentPerms.length} старых permissions.`);

    // Создаём новые
    let created = 0;
    for (const action of permissions) {
      try {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: role.id },
        });
        created++;
      } catch (e) {
        console.log(`  [ERR] ${action}: ${e.message}`);
      }
    }
    console.log(`  Создано ${created} permissions.\n`);
  }

  console.log('=== Готово! ===');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await fixPermissions();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
