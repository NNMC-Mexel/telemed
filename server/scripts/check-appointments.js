'use strict';

/**
 * Проверяем записи и связи с врачом
 */

async function checkAppointments() {
  console.log('=== Проверка записей ===\n');
  
  // Получаем всех врачей
  const doctors = await strapi.documents('api::doctor.doctor').findMany({
    populate: ['specialization'],
    status: 'published',
  });
  
  console.log('Врачи:');
  for (const doc of doctors) {
    console.log(`  - ${doc.fullName} | id=${doc.id} | documentId=${doc.documentId} | userId=${doc.userId}`);
  }
  
  // Получаем все записи
  const appointments = await strapi.documents('api::appointment.appointment').findMany({
    populate: ['doctor', 'patient'],
    status: 'published',
  });
  
  console.log(`\nВсего записей: ${appointments.length}`);
  
  for (const apt of appointments) {
    console.log(`\nЗапись: documentId=${apt.documentId}`);
    console.log(`  Дата: ${apt.dateTime}`);
    console.log(`  Статус: ${apt.statuse}`);
    console.log(`  Пациент: ${apt.patient?.fullName || 'N/A'} (id=${apt.patient?.id})`);
    console.log(`  Врач: ${apt.doctor?.fullName || 'НЕТ ВРАЧА!'} (id=${apt.doctor?.id}, documentId=${apt.doctor?.documentId})`);
  }
  
  console.log('\n=== Готово! ===');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await checkAppointments();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
