'use strict';

/**
 * Seed скрипт для телемедицинских данных
 * Добавляет специализации и настраивает права доступа
 */

async function setPublicPermissions(newPermissions) {
  // Find the ID of the public role
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: 'public',
    },
  });

  // Create the new permissions and link them to the public role
  const allPermissionsToCreate = [];
  Object.keys(newPermissions).map((controller) => {
    const actions = newPermissions[controller];
    const permissionsToCreate = actions.map((action) => {
      return strapi.query('plugin::users-permissions.permission').create({
        data: {
          action: `api::${controller}.${controller}.${action}`,
          role: publicRole.id,
        },
      });
    });
    allPermissionsToCreate.push(...permissionsToCreate);
  });
  await Promise.all(allPermissionsToCreate);
}

async function setAuthenticatedPermissions(newPermissions) {
  // Find the ID of the authenticated role
  const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: 'authenticated',
    },
  });

  // Create the new permissions and link them to the authenticated role
  const allPermissionsToCreate = [];
  Object.keys(newPermissions).map((controller) => {
    const actions = newPermissions[controller];
    const permissionsToCreate = actions.map((action) => {
      return strapi.query('plugin::users-permissions.permission').create({
        data: {
          action: `api::${controller}.${controller}.${action}`,
          role: authenticatedRole.id,
        },
      });
    });
    allPermissionsToCreate.push(...permissionsToCreate);
  });
  await Promise.all(allPermissionsToCreate);
}

// Список специализаций
const specializations = [
  { name: 'Терапевт', description: 'Врач общей практики', icon: 'stethoscope', sortOrder: 1 },
  { name: 'Кардиолог', description: 'Специалист по сердечно-сосудистым заболеваниям', icon: 'heart', sortOrder: 2 },
  { name: 'Невролог', description: 'Специалист по заболеваниям нервной системы', icon: 'brain', sortOrder: 3 },
  { name: 'Дерматолог', description: 'Специалист по заболеваниям кожи', icon: 'shield', sortOrder: 4 },
  { name: 'Гастроэнтеролог', description: 'Специалист по заболеваниям ЖКТ', icon: 'activity', sortOrder: 5 },
  { name: 'Эндокринолог', description: 'Специалист по гормональным нарушениям', icon: 'droplet', sortOrder: 6 },
  { name: 'Офтальмолог', description: 'Специалист по заболеваниям глаз', icon: 'eye', sortOrder: 7 },
  { name: 'Отоларинголог', description: 'ЛОР-врач', icon: 'ear', sortOrder: 8 },
  { name: 'Психотерапевт', description: 'Специалист по психическому здоровью', icon: 'user', sortOrder: 9 },
  { name: 'Педиатр', description: 'Детский врач', icon: 'baby', sortOrder: 10 },
  { name: 'Гинеколог', description: 'Специалист по женскому здоровью', icon: 'female', sortOrder: 11 },
  { name: 'Уролог', description: 'Специалист по мочеполовой системе', icon: 'male', sortOrder: 12 },
];

async function createSpecializations() {
  console.log('Creating specializations...');
  
  for (const spec of specializations) {
    // Check if specialization already exists (check both published and draft)
    const existingPublished = await strapi.documents('api::specialization.specialization').findMany({
      filters: { name: spec.name },
      status: 'published',
    });
    const existingDraft = await strapi.documents('api::specialization.specialization').findMany({
      filters: { name: spec.name },
      status: 'draft',
    });
    
    if (existingPublished.length === 0 && existingDraft.length === 0) {
      // Create and publish the specialization
      const created = await strapi.documents('api::specialization.specialization').create({
        data: spec,
      });
      // Publish it
      await strapi.documents('api::specialization.specialization').publish({
        documentId: created.documentId,
      });
      console.log(`Created and published specialization: ${spec.name}`);
    } else if (existingDraft.length > 0) {
      // Publish existing draft
      await strapi.documents('api::specialization.specialization').publish({
        documentId: existingDraft[0].documentId,
      });
      console.log(`Published existing draft: ${spec.name}`);
    } else {
      console.log(`Specialization already exists: ${spec.name}`);
    }
  }
}

async function seedMedicalData() {
  try {
    console.log('Setting up medical API permissions...');
    
    // Public permissions - read only
    await setPublicPermissions({
      specialization: ['find', 'findOne'],
      doctor: ['find', 'findOne'],
      review: ['find', 'findOne'],
    });
    
    // Authenticated permissions - CRUD for appointments, documents, etc.
    await setAuthenticatedPermissions({
      specialization: ['find', 'findOne'],
      doctor: ['find', 'findOne', 'create', 'update'],
      appointment: ['find', 'findOne', 'create', 'update'],
      review: ['find', 'findOne', 'create'],
      'medical-document': ['find', 'findOne', 'create', 'update', 'delete'],
      conversation: ['find', 'findOne', 'create', 'update'],
      message: ['find', 'findOne', 'create'],
      'time-slot': ['find', 'findOne', 'create', 'update', 'delete'],
    });
    
    console.log('Permissions set successfully!');
    
    // Create specializations
    await createSpecializations();
    
    console.log('Medical seed data imported successfully!');
  } catch (error) {
    console.error('Error seeding medical data:', error);
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedMedicalData();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
