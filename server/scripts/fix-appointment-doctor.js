'use strict';

/**
 * Исправляет записи без привязки к врачу
 */

async function fixAppointmentDoctor() {
  console.log('=== Исправление записей без врача ===\n');
  
  // Находим врача "Михаилов Азат"
  const doctors = await strapi.documents('api::doctor.doctor').findMany({
    filters: { fullName: { $contains: 'Михаилов' } },
    status: 'published',
  });
  
  if (doctors.length === 0) {
    console.log('Врач "Михаилов" не найден');
    return;
  }
  
  const mikhailovDoctor = doctors[0];
  console.log(`Найден врач: ${mikhailovDoctor.fullName} (ID=${mikhailovDoctor.id}, documentId=${mikhailovDoctor.documentId})`);
  
  // Находим запись без врача
  const allAppointments = await strapi.documents('api::appointment.appointment').findMany({
    populate: ['doctor', 'patient'],
    status: 'published',
  });
  
  for (const apt of allAppointments) {
    if (!apt.doctor || !apt.doctor.id) {
      console.log(`\nЗапись без врача: ID=${apt.id}, documentId=${apt.documentId}`);
      console.log(`  Пациент: ${apt.patient?.fullName || 'N/A'}`);
      console.log(`  Дата: ${apt.dateTime}`);
      console.log(`  Привязываем к врачу ${mikhailovDoctor.fullName}...`);
      
      try {
        // Обновляем запись - устанавливаем врача по documentId
        await strapi.documents('api::appointment.appointment').update({
          documentId: apt.documentId,
          data: {
            doctor: mikhailovDoctor.documentId, // В Strapi v5 используем documentId для связей
          },
        });
        
        // Публикуем
        await strapi.documents('api::appointment.appointment').publish({
          documentId: apt.documentId,
        });
        
        console.log(`  ✓ Успешно!`);
      } catch (error) {
        console.error(`  ✗ Ошибка: ${error.message}`);
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

  await fixAppointmentDoctor();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
