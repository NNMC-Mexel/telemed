'use strict';

/**
 * Публикация всех специализаций
 */

async function publishSpecializations() {
  console.log('Publishing all specializations...');
  
  // Получаем все специализации включая черновики
  const specializations = await strapi.documents('api::specialization.specialization').findMany({
    status: 'draft',
  });
  
  console.log(`Found ${specializations.length} draft specializations`);
  
  for (const spec of specializations) {
    try {
      await strapi.documents('api::specialization.specialization').publish({
        documentId: spec.documentId,
      });
      console.log(`Published: ${spec.name}`);
    } catch (error) {
      console.error(`Error publishing ${spec.name}:`, error.message);
    }
  }
  
  console.log('Done!');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await publishSpecializations();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
