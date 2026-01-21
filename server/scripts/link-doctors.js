'use strict';

/**
 * Скрипт для связывания врачей с пользователями и диагностики
 */

async function linkDoctors() {
  console.log('=== Диагностика и исправление связей врачей ===\n');
  
  // Получаем всех пользователей
  const users = await strapi.query('plugin::users-permissions.user').findMany({
    populate: ['role'],
  });
  
  console.log('Пользователи в системе:');
  for (const user of users) {
    console.log(`  ID=${user.id}, username=${user.username}, email=${user.email}, role=${user.userRole || 'N/A'}`);
  }
  console.log('');
  
  // Получаем всех врачей
  const doctors = await strapi.documents('api::doctor.doctor').findMany({
    populate: ['users_permissions_user', 'specialization'],
    status: 'published',
  });
  
  console.log('Врачи (published):');
  for (const doc of doctors) {
    console.log(`  ID=${doc.id}, documentId=${doc.documentId}, name=${doc.fullName}, user=${doc.users_permissions_user?.id || 'НЕ ПРИВЯЗАН'}`);
  }
  
  // Также проверим черновики
  const draftDoctors = await strapi.documents('api::doctor.doctor').findMany({
    populate: ['users_permissions_user', 'specialization'],
    status: 'draft',
  });
  
  console.log('\nВрачи (draft):');
  for (const doc of draftDoctors) {
    console.log(`  ID=${doc.id}, documentId=${doc.documentId}, name=${doc.fullName}, user=${doc.users_permissions_user?.id || 'НЕ ПРИВЯЗАН'}`);
  }
  console.log('');
  
  // Пытаемся связать врачей с пользователями по имени или email
  const doctorUsers = users.filter(u => u.userRole === 'doctor');
  console.log(`\nПользователи с ролью doctor: ${doctorUsers.length}`);
  
  for (const user of doctorUsers) {
    console.log(`\nПроверяем пользователя: ${user.username} (ID=${user.id})`);
    
    // Ищем врача с похожим именем
    const allDoctors = [...doctors, ...draftDoctors];
    let matchedDoctor = allDoctors.find(d => 
      d.fullName?.toLowerCase().includes(user.fullName?.toLowerCase()) ||
      user.fullName?.toLowerCase().includes(d.fullName?.toLowerCase().split(' ')[0])
    );
    
    if (!matchedDoctor && user.email) {
      // Пытаемся найти по части имени из email
      const emailName = user.email.split('@')[0];
      matchedDoctor = allDoctors.find(d => 
        d.fullName?.toLowerCase().includes(emailName.toLowerCase())
      );
    }
    
    if (matchedDoctor && !matchedDoctor.users_permissions_user) {
      console.log(`  Найден врач без связи: ${matchedDoctor.fullName} (ID=${matchedDoctor.id})`);
      console.log(`  Привязываем к пользователю ${user.id}...`);
      
      try {
        await strapi.documents('api::doctor.doctor').update({
          documentId: matchedDoctor.documentId,
          data: {
            users_permissions_user: user.id,
          },
        });
        console.log(`  ✓ Успешно связано!`);
        
        // Публикуем если был черновиком
        if (!matchedDoctor.publishedAt) {
          await strapi.documents('api::doctor.doctor').publish({
            documentId: matchedDoctor.documentId,
          });
          console.log(`  ✓ Опубликовано!`);
        }
      } catch (error) {
        console.error(`  ✗ Ошибка: ${error.message}`);
      }
    } else if (matchedDoctor) {
      console.log(`  Врач ${matchedDoctor.fullName} уже привязан к пользователю ${matchedDoctor.users_permissions_user?.id}`);
    } else {
      console.log(`  Не найден подходящий врач для пользователя ${user.username}`);
      console.log(`  Создаём новый профиль врача...`);
      
      try {
        const newDoctor = await strapi.documents('api::doctor.doctor').create({
          data: {
            fullName: user.fullName || user.username,
            users_permissions_user: user.id,
            isActive: true,
            rating: 0,
            reviewsCount: 0,
            price: 8000,
            experience: 0,
            workStartTime: '09:00',
            workEndTime: '18:00',
            breakStart: '12:00',
            breakEnd: '14:00',
            slotDuration: 30,
            workingDays: '1,2,3,4,5',
          },
        });
        console.log(`  ✓ Создан новый профиль врача: ${newDoctor.fullName} (ID=${newDoctor.id})`);
        
        // Публикуем
        await strapi.documents('api::doctor.doctor').publish({
          documentId: newDoctor.documentId,
        });
        console.log(`  ✓ Опубликовано!`);
      } catch (error) {
        console.error(`  ✗ Ошибка создания: ${error.message}`);
      }
    }
  }
  
  console.log('\n=== Готово! ===');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await linkDoctors();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
