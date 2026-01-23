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

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // Seed specializations if none exist
    const existingSpecializations = await strapi.documents('api::specialization.specialization').findMany({
      limit: 1,
    });

    if (existingSpecializations.length === 0) {
      console.log('📋 Seeding specializations...');

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

          // Publish the specialization
          if (created?.documentId) {
            await strapi.documents('api::specialization.specialization').publish({
              documentId: created.documentId,
            });
          }

          console.log(`✅ Created specialization: ${spec.name}`);
        } catch (error) {
          console.error(`❌ Error creating specialization ${spec.name}:`, error);
        }
      }

      console.log('✅ Specializations seeded successfully!');
    } else {
      console.log('📋 Specializations already exist, skipping seed.');
    }
  },
};
