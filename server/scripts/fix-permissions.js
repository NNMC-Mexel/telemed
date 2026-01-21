'use strict';

/**
 * Исправляем права доступа для API
 */

async function fixPermissions() {
  console.log('=== Настройка прав доступа ===\n');
  
  // Получаем роли
  const roles = await strapi.query('plugin::users-permissions.role').findMany();
  
  const authenticatedRole = roles.find(r => r.type === 'authenticated');
  const publicRole = roles.find(r => r.type === 'public');
  
  console.log('Authenticated role ID:', authenticatedRole?.id);
  console.log('Public role ID:', publicRole?.id);
  
  // Список эндпоинтов для authenticated users
  const authenticatedPermissions = [
    // Appointments - полный доступ
    { action: 'api::appointment.appointment.find' },
    { action: 'api::appointment.appointment.findOne' },
    { action: 'api::appointment.appointment.create' },
    { action: 'api::appointment.appointment.update' },
    { action: 'api::appointment.appointment.delete' },
    
    // Doctors - чтение и обновление своего профиля
    { action: 'api::doctor.doctor.find' },
    { action: 'api::doctor.doctor.findOne' },
    { action: 'api::doctor.doctor.create' },
    { action: 'api::doctor.doctor.update' },
    
    // Specializations - чтение
    { action: 'api::specialization.specialization.find' },
    { action: 'api::specialization.specialization.findOne' },
    
    // Reviews
    { action: 'api::review.review.find' },
    { action: 'api::review.review.findOne' },
    { action: 'api::review.review.create' },
    
    // Time slots
    { action: 'api::time-slot.time-slot.find' },
    { action: 'api::time-slot.time-slot.findOne' },
    
    // Messages & Conversations
    { action: 'api::message.message.find' },
    { action: 'api::message.message.findOne' },
    { action: 'api::message.message.create' },
    { action: 'api::conversation.conversation.find' },
    { action: 'api::conversation.conversation.findOne' },
    { action: 'api::conversation.conversation.create' },
    
    // Medical documents
    { action: 'api::medical-document.medical-document.find' },
    { action: 'api::medical-document.medical-document.findOne' },
    { action: 'api::medical-document.medical-document.create' },
    
    // Upload
    { action: 'plugin::upload.content-api.upload' },
    { action: 'plugin::upload.content-api.find' },
    { action: 'plugin::upload.content-api.findOne' },
  ];
  
  // Список эндпоинтов для public
  const publicPermissions = [
    { action: 'api::doctor.doctor.find' },
    { action: 'api::doctor.doctor.findOne' },
    { action: 'api::specialization.specialization.find' },
    { action: 'api::specialization.specialization.findOne' },
    { action: 'api::review.review.find' },
    { action: 'api::time-slot.time-slot.find' },
  ];
  
  // Настраиваем права для authenticated
  console.log('\nНастройка прав для authenticated users...');
  for (const perm of authenticatedPermissions) {
    try {
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action: perm.action, role: authenticatedRole.id }
      });
      
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action: perm.action, role: authenticatedRole.id }
        });
        console.log(`  ✓ Добавлено: ${perm.action}`);
      } else {
        console.log(`  - Уже есть: ${perm.action}`);
      }
    } catch (e) {
      console.log(`  ✗ Ошибка для ${perm.action}: ${e.message}`);
    }
  }
  
  // Настраиваем права для public
  console.log('\nНастройка прав для public users...');
  for (const perm of publicPermissions) {
    try {
      const existing = await strapi.query('plugin::users-permissions.permission').findOne({
        where: { action: perm.action, role: publicRole.id }
      });
      
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action: perm.action, role: publicRole.id }
        });
        console.log(`  ✓ Добавлено: ${perm.action}`);
      } else {
        console.log(`  - Уже есть: ${perm.action}`);
      }
    } catch (e) {
      console.log(`  ✗ Ошибка для ${perm.action}: ${e.message}`);
    }
  }
  
  console.log('\n=== Готово! ===');
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
