'use strict';

/**
 * Миграция существующих пользователей на новые Strapi-роли.
 *
 * Логика:
 *   - Читает поле `userRole` каждого пользователя (patient | doctor | admin)
 *   - Находит соответствующую Strapi-роль по type
 *   - Переназначает пользователя на эту роль
 *   - Пользователи без userRole получают роль patient
 *
 * Запуск: node scripts/migrate-user-roles.js
 *
 * Флаг --dry-run покажет план миграции без изменений:
 *   node scripts/migrate-user-roles.js --dry-run
 */

const isDryRun = process.argv.includes('--dry-run');

async function migrateUserRoles() {
  console.log(`=== Миграция ролей пользователей ${isDryRun ? '(DRY RUN)' : ''} ===\n`);

  // Загружаем все роли
  const roles = await strapi.query('plugin::users-permissions.role').findMany();
  const roleMap = {};
  for (const role of roles) {
    roleMap[role.type] = role;
  }

  // Проверяем, что нужные роли существуют
  const requiredRoles = ['patient', 'doctor', 'admin'];
  for (const type of requiredRoles) {
    if (!roleMap[type]) {
      console.error(`Роль "${type}" не найдена! Запустите bootstrap сервера для создания ролей.`);
      process.exit(1);
    }
  }

  console.log('Найденные роли:');
  for (const [type, role] of Object.entries(roleMap)) {
    console.log(`  ${type}: id=${role.id}, name=${role.name}`);
  }
  console.log('');

  // Загружаем всех пользователей с их текущими ролями
  const users = await strapi.query('plugin::users-permissions.user').findMany({
    populate: ['role'],
  });

  console.log(`Всего пользователей: ${users.length}\n`);

  const stats = { migrated: 0, skipped: 0, errors: 0 };

  for (const user of users) {
    const currentRoleType = user.role?.type;
    const targetRoleType = user.userRole || 'patient';

    // Если пользователь уже на правильной роли — пропускаем
    if (currentRoleType === targetRoleType) {
      console.log(`  [SKIP] ${user.email} — уже на роли "${targetRoleType}"`);
      stats.skipped++;
      continue;
    }

    const targetRole = roleMap[targetRoleType];
    if (!targetRole) {
      console.log(`  [ERR]  ${user.email} — роль "${targetRoleType}" не найдена`);
      stats.errors++;
      continue;
    }

    console.log(`  [${isDryRun ? 'PLAN' : 'MIGRATE'}] ${user.email}: "${currentRoleType}" -> "${targetRoleType}"`);

    if (!isDryRun) {
      try {
        await strapi.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: { role: targetRole.id },
        });
        stats.migrated++;
      } catch (e) {
        console.log(`  [ERR]  ${user.email}: ${e.message}`);
        stats.errors++;
      }
    } else {
      stats.migrated++;
    }
  }

  console.log(`\n=== Результат ${isDryRun ? '(DRY RUN)' : ''} ===`);
  console.log(`  Мигрировано: ${stats.migrated}`);
  console.log(`  Пропущено:   ${stats.skipped}`);
  console.log(`  Ошибок:      ${stats.errors}`);

  if (isDryRun) {
    console.log('\nЭто был dry run. Для реальной миграции запустите без --dry-run.');
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await migrateUserRoles();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
