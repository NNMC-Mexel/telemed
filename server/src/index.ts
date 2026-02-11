import type { Core } from '@strapi/strapi';

const defaultSpecializations = [
  { name: 'Терапевт', description: 'Врач общей практики', icon: 'stethoscope', sortOrder: 1 },
  { name: 'Кардиолог', description: 'Специалист по сердечно-сосудистой системе', icon: 'heart', sortOrder: 2 },
  { name: 'Невролог', description: 'Специалист по нервной системе', icon: 'brain', sortOrder: 3 },
  { name: 'Дерматолог', description: 'Специалист по кожным заболеваниям', icon: 'hand', sortOrder: 4 },
  { name: 'Офтальмолог', description: 'Специалист по заболеваниям глаз', icon: 'eye', sortOrder: 5 },
  { name: 'ЛОР', description: 'Отоларинголог - специалист по уху, горлу, носу', icon: 'ear', sortOrder: 6 },
  { name: 'Эндокринолог', description: 'Специалист по эндокринной системе', icon: 'activity', sortOrder: 7 },
  { name: 'Гастроэнтеролог', description: 'Специалист по желудочно-кишечному тракту', icon: 'stomach', sortOrder: 8 },
  { name: 'Уролог', description: 'Специалист по мочеполовой системе', icon: 'kidney', sortOrder: 9 },
  { name: 'Гинеколог', description: 'Специалист по женскому здоровью', icon: 'female', sortOrder: 10 },
  { name: 'Педиатр', description: 'Детский врач', icon: 'baby', sortOrder: 11 },
  { name: 'Психиатр', description: 'Специалист по психическому здоровью', icon: 'brain', sortOrder: 12 },
  { name: 'Психолог', description: 'Специалист по психологическому здоровью', icon: 'smile', sortOrder: 13 },
  { name: 'Хирург', description: 'Специалист по хирургическим операциям', icon: 'scissors', sortOrder: 14 },
  { name: 'Ортопед', description: 'Специалист по опорно-двигательной системе', icon: 'bone', sortOrder: 15 },
];

// Определение ролей и их permissions
const roleDefinitions = {
  patient: {
    name: 'Patient',
    description: 'Пациент — может записываться к врачам, просматривать свои записи и документы',
    permissions: [
      // Doctors — только чтение
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      // Specializations — только чтение
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      // Appointments — CRUD (ownership проверяется policy)
      'api::appointment.appointment.find',
      'api::appointment.appointment.findOne',
      'api::appointment.appointment.create',
      'api::appointment.appointment.update',
      // Reviews — чтение + создание
      'api::review.review.find',
      'api::review.review.findOne',
      'api::review.review.create',
      // Time slots — только чтение
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      // Messages & Conversations
      'api::message.message.find',
      'api::message.message.findOne',
      'api::message.message.create',
      'api::conversation.conversation.find',
      'api::conversation.conversation.findOne',
      'api::conversation.conversation.create',
      // Medical documents — чтение + создание
      'api::medical-document.medical-document.find',
      'api::medical-document.medical-document.findOne',
      'api::medical-document.medical-document.create',
      // Upload
      'plugin::upload.content-api.upload',
      'plugin::upload.content-api.find',
      'plugin::upload.content-api.findOne',
      // Users-permissions — профиль
      'plugin::users-permissions.user.me',
    ],
  },
  doctor: {
    name: 'Doctor',
    description: 'Врач — управляет своим профилем, слотами, видит свои записи',
    permissions: [
      // Doctor profile — чтение + обновление своего
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::doctor.doctor.update',
      // Specializations — чтение
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      // Appointments — чтение + обновление (статус)
      'api::appointment.appointment.find',
      'api::appointment.appointment.findOne',
      'api::appointment.appointment.update',
      // Reviews — только чтение
      'api::review.review.find',
      'api::review.review.findOne',
      // Time slots — полный CRUD
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      'api::time-slot.time-slot.create',
      'api::time-slot.time-slot.update',
      'api::time-slot.time-slot.delete',
      // Messages & Conversations
      'api::message.message.find',
      'api::message.message.findOne',
      'api::message.message.create',
      'api::conversation.conversation.find',
      'api::conversation.conversation.findOne',
      'api::conversation.conversation.create',
      // Medical documents — полный CRUD (для своих пациентов)
      'api::medical-document.medical-document.find',
      'api::medical-document.medical-document.findOne',
      'api::medical-document.medical-document.create',
      'api::medical-document.medical-document.update',
      // Upload
      'plugin::upload.content-api.upload',
      'plugin::upload.content-api.find',
      'plugin::upload.content-api.findOne',
      // Users-permissions — профиль
      'plugin::users-permissions.user.me',
    ],
  },
  admin: {
    name: 'Admin',
    description: 'Администратор — полный доступ ко всем данным',
    permissions: [
      // Doctors — полный CRUD
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::doctor.doctor.create',
      'api::doctor.doctor.update',
      'api::doctor.doctor.delete',
      // Specializations — полный CRUD
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      'api::specialization.specialization.create',
      'api::specialization.specialization.update',
      'api::specialization.specialization.delete',
      // Appointments — полный CRUD
      'api::appointment.appointment.find',
      'api::appointment.appointment.findOne',
      'api::appointment.appointment.create',
      'api::appointment.appointment.update',
      'api::appointment.appointment.delete',
      // Reviews — полный CRUD
      'api::review.review.find',
      'api::review.review.findOne',
      'api::review.review.create',
      'api::review.review.update',
      'api::review.review.delete',
      // Time slots — полный CRUD
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      'api::time-slot.time-slot.create',
      'api::time-slot.time-slot.update',
      'api::time-slot.time-slot.delete',
      // Messages & Conversations — полный CRUD
      'api::message.message.find',
      'api::message.message.findOne',
      'api::message.message.create',
      'api::message.message.update',
      'api::message.message.delete',
      'api::conversation.conversation.find',
      'api::conversation.conversation.findOne',
      'api::conversation.conversation.create',
      'api::conversation.conversation.update',
      'api::conversation.conversation.delete',
      // Medical documents — полный CRUD
      'api::medical-document.medical-document.find',
      'api::medical-document.medical-document.findOne',
      'api::medical-document.medical-document.create',
      'api::medical-document.medical-document.update',
      'api::medical-document.medical-document.delete',
      // Articles — полный CRUD
      'api::article.article.find',
      'api::article.article.findOne',
      'api::article.article.create',
      'api::article.article.update',
      'api::article.article.delete',
      // Landing content — управление single types
      'api::global.global.find',
      'api::global.global.findOne',
      'api::global.global.update',
      'api::about.about.find',
      'api::about.about.findOne',
      'api::about.about.update',
      // Upload
      'plugin::upload.content-api.upload',
      'plugin::upload.content-api.find',
      'plugin::upload.content-api.findOne',
      'plugin::upload.content-api.destroy',
      // Users-permissions
      'plugin::users-permissions.user.find',
      'plugin::users-permissions.user.findOne',
      'plugin::users-permissions.user.create',
      'plugin::users-permissions.user.update',
      'plugin::users-permissions.user.destroy',
      'plugin::users-permissions.user.me',
    ],
  },
};

async function seedSpecializations(strapi: Core.Strapi) {
  const existing = await strapi.documents('api::specialization.specialization').findMany({
    limit: 1,
  });

  if (existing.length > 0) {
    console.log('Specializations already exist, skipping seed.');
    return;
  }

  console.log('Seeding specializations...');
  for (const spec of defaultSpecializations) {
    try {
      const created = await strapi.documents('api::specialization.specialization').create({
        data: {
          name: spec.name,
          description: spec.description,
          icon: spec.icon,
          sortOrder: spec.sortOrder,
        },
      });

      if (created?.documentId) {
        await strapi.documents('api::specialization.specialization').publish({
          documentId: created.documentId,
        });
      }
      console.log(`  Created specialization: ${spec.name}`);
    } catch (error) {
      console.error(`  Error creating specialization ${spec.name}:`, error);
    }
  }
  console.log('Specializations seeded.');
}

async function seedRolesAndPermissions(strapi: Core.Strapi) {
  console.log('Setting up roles and permissions...');

  for (const [roleType, definition] of Object.entries(roleDefinitions)) {
    // Проверяем, существует ли роль
    const existingRole = await strapi
      .query('plugin::users-permissions.role')
      .findOne({ where: { type: roleType } });

    let roleId: number;

    if (existingRole) {
      console.log(`  Role "${definition.name}" already exists (id=${existingRole.id}).`);
      roleId = existingRole.id;
    } else {
      const created = await strapi.query('plugin::users-permissions.role').create({
        data: {
          name: definition.name,
          description: definition.description,
          type: roleType,
        },
      });
      console.log(`  Created role "${definition.name}" (id=${created.id}).`);
      roleId = created.id;
    }

    // Назначаем permissions
    for (const action of definition.permissions) {
      try {
        const existingPerm = await strapi
          .query('plugin::users-permissions.permission')
          .findOne({ where: { action, role: roleId } });

        if (!existingPerm) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: { action, role: roleId },
          });
        }
      } catch (e: any) {
        console.error(`  Error setting permission ${action} for ${definition.name}: ${e.message}`);
      }
    }
    console.log(`  Permissions set for "${definition.name}".`);
  }

  // Убираем опасные permissions из authenticated (если она осталась дефолтной)
  const authenticatedRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'authenticated' } });

  if (authenticatedRole) {
    // Для authenticated оставляем только минимальный доступ (чтение публичных данных)
    const allowedForAuthenticated = [
      'api::doctor.doctor.find',
      'api::doctor.doctor.findOne',
      'api::specialization.specialization.find',
      'api::specialization.specialization.findOne',
      'api::review.review.find',
      'api::time-slot.time-slot.find',
      'api::time-slot.time-slot.findOne',
      'plugin::users-permissions.user.me',
    ];

    // Удаляем все текущие permissions этой роли
    const currentPerms = await strapi
      .query('plugin::users-permissions.permission')
      .findMany({ where: { role: authenticatedRole.id } });

    for (const perm of currentPerms) {
      if (!allowedForAuthenticated.includes(perm.action)) {
        await strapi.query('plugin::users-permissions.permission').delete({
          where: { id: perm.id },
        });
      }
    }

    // Добавляем минимальные, если их нет
    for (const action of allowedForAuthenticated) {
      const existing = await strapi
        .query('plugin::users-permissions.permission')
        .findOne({ where: { action, role: authenticatedRole.id } });
      if (!existing) {
        await strapi.query('plugin::users-permissions.permission').create({
          data: { action, role: authenticatedRole.id },
        });
      }
    }
    console.log('  Authenticated role stripped to read-only public data.');
  }

  console.log('Roles and permissions setup complete.');
}

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await seedSpecializations(strapi);
    await seedRolesAndPermissions(strapi);
  },
};
