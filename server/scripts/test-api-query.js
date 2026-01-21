'use strict';

async function testApiQuery() {
  console.log('=== Тест API запроса для записей врача ===\n');
  
  const doctorId = 9; // Михаилов Азат
  const today = new Date().toISOString().split("T")[0];
  
  console.log(`Запрос записей для doctor.id=${doctorId} с даты ${today}\n`);
  
  // Симулируем API запрос
  const appointments = await strapi.documents('api::appointment.appointment').findMany({
    filters: {
      doctor: { id: { $eq: doctorId } },
      dateTime: { $gte: today }
    },
    populate: ['doctor', 'patient'],
    status: 'published',
  });
  
  console.log(`Найдено записей: ${appointments.length}`);
  
  for (const apt of appointments) {
    console.log(`\n  - ${apt.documentId}`);
    console.log(`    Дата: ${apt.dateTime}`);
    console.log(`    Статус: ${apt.statuse}`);
    console.log(`    Врач id: ${apt.doctor?.id}`);
    console.log(`    Пациент: ${apt.patient?.fullName}`);
  }
  
  // Также попробуем без фильтра по дате
  console.log('\n\n=== Все записи для этого врача (без фильтра даты) ===');
  
  const allAppts = await strapi.documents('api::appointment.appointment').findMany({
    filters: {
      doctor: { id: { $eq: doctorId } }
    },
    populate: ['doctor', 'patient'],
    status: 'published',
  });
  
  console.log(`Найдено записей: ${allAppts.length}`);
  
  for (const apt of allAppts) {
    console.log(`\n  - ${apt.documentId}`);
    console.log(`    Дата: ${apt.dateTime}`);
    console.log(`    Статус: ${apt.statuse}`);
  }
  
  console.log('\n=== Готово! ===');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await testApiQuery();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
