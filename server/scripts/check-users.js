'use strict';

async function checkUsers() {
  console.log('=== Проверка пользователей ===\n');
  
  const users = await strapi.query('plugin::users-permissions.user').findMany({
    populate: ['role']
  });
  
  for (const user of users) {
    console.log(`User: id=${user.id}, email=${user.email}, username=${user.username}, role=${user.role?.type}`);
  }
  
  console.log('\n=== Готово! ===');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await checkUsers();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
