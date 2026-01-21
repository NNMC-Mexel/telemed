'use strict';

/**
 * Исправляет связи в записях на приём после изменения ID врачей
 */

async function fixAppointments() {
  console.log('=== Исправление записей на приём ===\n');
  
  // Получаем все записи на приём
  const appointments = await strapi.documents('api::appointment.appointment').findMany({
    populate: ['doctor', 'patient'],
    status: 'published',
  });
  
  const draftAppointments = await strapi.documents('api::appointment.appointment').findMany({
    populate: ['doctor', 'patient'],
    status: 'draft',
  });
  
  console.log(`Найдено записей (published): ${appointments.length}`);
  console.log(`Найдено записей (draft): ${draftAppointments.length}\n`);
  
  // Получаем всех врачей
  const doctors = await strapi.documents('api::doctor.doctor').findMany({
    status: 'published',
  });
  
  console.log('Врачи:');
  for (const doc of doctors) {
    console.log(`  ID=${doc.id}, documentId=${doc.documentId}, name=${doc.fullName}`);
  }
  console.log('');
  
  // Создаем маппинг documentId -> id для врачей
  const doctorMap = {};
  for (const doc of doctors) {
    doctorMap[doc.documentId] = doc.id;
  }
  
  // Проверяем и исправляем записи
  const allAppointments = [...appointments, ...draftAppointments];
  
  for (const apt of allAppointments) {
    console.log(`\nЗапись ID=${apt.id}, documentId=${apt.documentId}`);
    console.log(`  Пациент: ${apt.patient?.fullName || apt.patient?.id || 'N/A'}`);
    console.log(`  Врач: ID=${apt.doctor?.id || 'N/A'}, name=${apt.doctor?.fullName || 'N/A'}`);
    console.log(`  Дата: ${apt.dateTime}`);
    
    // Если врач указан, но его ID не найден в текущих врачах
    if (apt.doctor?.documentId && !doctors.find(d => d.id === apt.doctor.id)) {
      const correctId = doctorMap[apt.doctor.documentId];
      if (correctId) {
        console.log(`  ⚠ ID врача устарел. Новый ID: ${correctId}`);
        // В Strapi v5 связи обновляются через documentId, а не id
      }
    }
  }
  
  // Публикуем все черновики записей
  for (const apt of draftAppointments) {
    try {
      await strapi.documents('api::appointment.appointment').publish({
        documentId: apt.documentId,
      });
      console.log(`\n✓ Опубликована запись: ${apt.documentId}`);
    } catch (error) {
      console.error(`\n✗ Ошибка публикации: ${error.message}`);
    }
  }
  
  console.log('\n=== Готово! ===');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await fixAppointments();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
