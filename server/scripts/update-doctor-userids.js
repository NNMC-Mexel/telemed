'use strict';

/**
 * Обновляет поле userId у существующих врачей на основе связи users_permissions_user
 */

async function updateDoctorUserIds() {
  console.log('=== Обновление userId у врачей ===\n');
  
  // Получаем всех врачей (published и draft)
  const publishedDoctors = await strapi.documents('api::doctor.doctor').findMany({
    populate: ['users_permissions_user'],
    status: 'published',
  });
  
  const draftDoctors = await strapi.documents('api::doctor.doctor').findMany({
    populate: ['users_permissions_user'],
    status: 'draft',
  });
  
  const allDoctors = [...publishedDoctors, ...draftDoctors];
  
  // Уникальные по documentId
  const uniqueDoctors = [];
  const seenDocIds = new Set();
  for (const doc of allDoctors) {
    if (!seenDocIds.has(doc.documentId)) {
      seenDocIds.add(doc.documentId);
      uniqueDoctors.push(doc);
    }
  }
  
  console.log(`Найдено ${uniqueDoctors.length} врачей\n`);
  
  for (const doctor of uniqueDoctors) {
    const userId = doctor.users_permissions_user?.id;
    
    if (userId && doctor.userId !== userId) {
      console.log(`Обновляем врача: ${doctor.fullName} (ID=${doctor.id})`);
      console.log(`  Устанавливаем userId = ${userId}`);
      
      try {
        await strapi.documents('api::doctor.doctor').update({
          documentId: doctor.documentId,
          data: {
            userId: userId,
          },
        });
        
        // Публикуем изменения
        await strapi.documents('api::doctor.doctor').publish({
          documentId: doctor.documentId,
        });
        
        console.log(`  ✓ Успешно обновлено и опубликовано!\n`);
      } catch (error) {
        console.error(`  ✗ Ошибка: ${error.message}\n`);
      }
    } else if (!userId) {
      console.log(`Врач ${doctor.fullName} (ID=${doctor.id}) не имеет связи с пользователем\n`);
    } else {
      console.log(`Врач ${doctor.fullName} (ID=${doctor.id}) уже имеет userId=${doctor.userId}\n`);
    }
  }
  
  console.log('=== Готово! ===');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await updateDoctorUserIds();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
