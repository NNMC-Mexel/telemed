'use strict';

/**
 * Скрипт для подтверждения всех записей со статусом "pending"
 * Так как клиенты уже оплатили, подтверждение не нужно
 */

async function confirmAllAppointments() {
  console.log('=== Подтверждение всех pending записей ===\n');
  
  // Получаем все appointments со статусом pending
  const pendingAppointments = await strapi.documents('api::appointment.appointment').findMany({
    filters: { statuse: { $eq: 'pending' } },
  });
  
  console.log(`Найдено ${pendingAppointments.length} записей со статусом pending`);
  
  for (const apt of pendingAppointments) {
    try {
      console.log(`Подтверждаем запись ${apt.documentId}...`);
      
      await strapi.documents('api::appointment.appointment').update({
        documentId: apt.documentId,
        data: { 
          statuse: 'confirmed',
          paymentStatus: 'paid'
        },
      });
      
      // Публикуем
      await strapi.documents('api::appointment.appointment').publish({
        documentId: apt.documentId,
      });
      
      console.log(`  ✓ Запись ${apt.documentId} подтверждена`);
    } catch (error) {
      console.error(`  ✗ Ошибка для ${apt.documentId}: ${error.message}`);
    }
  }
  
  console.log('\n=== Готово! Все pending записи теперь confirmed ===');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await confirmAllAppointments();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
