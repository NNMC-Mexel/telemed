/**
 * Расширение users-permissions: кастомная регистрация.
 *
 * ВАЖНО: В Strapi v5 контроллеры плагинов — это factory-функции:
 *   plugin.controllers.auth = ({ strapi }) => ({ register, login, ... })
 * Поэтому нужно оборачивать саму factory, а не пытаться подменить метод.
 *
 * Принимает дополнительные поля при регистрации:
 *   - userRole: 'patient' | 'doctor' (admin запрещён)
 *   - fullName, phone, iin
 *   - doctorData: { specialization, experience, education, ... } (только для doctor)
 *
 * Автоматически:
 *   - Назначает правильную Strapi-роль (patient/doctor вместо authenticated)
 *   - Создаёт Doctor-профиль при регистрации врача
 *   - Возвращает полные данные user в ответе
 */
export default (plugin) => {
  // Сохраняем оригинальную factory-функцию контроллера auth
  const originalAuthFactory = plugin.controllers.auth;

  // Заменяем на новую factory, которая оборачивает оригинальную
  plugin.controllers.auth = (factoryContext) => {
    // Вызываем оригинальную factory, чтобы получить все методы контроллера
    const originalController = originalAuthFactory(factoryContext);
    const originalRegister = originalController.register;

    return {
      ...originalController,

      async register(ctx) {
        console.log('[auth.register] Custom registration handler started');

        // 0. Извлекаем дополнительные поля и УБИРАЕМ из body,
        //    иначе Strapi-валидация отклонит запрос: "Invalid parameters"
        const requestBody = ctx.request?.body || {};
        const sourceBody =
          requestBody?.data && typeof requestBody.data === 'object'
            ? requestBody.data
            : requestBody;

        const { userRole: rawRole, fullName, phone, iin, doctorData, ...cleanBody } = sourceBody;

        // Безопасность: admin нельзя создать через регистрацию
        const normalizedRole = typeof rawRole === 'string' ? rawRole.toLowerCase() : null;
        const inferredDoctor = normalizedRole === 'doctor' || !!doctorData;
        const userRole = inferredDoctor ? 'doctor' : 'patient';

        console.log(`[auth.register] userRole=${userRole}, fullName=${fullName}, hasDoctor=${!!doctorData}`);

        // Подменяем body — оставляем только username, email, password
        ctx.request.body = cleanBody;

        // Вызываем оригинальную регистрацию Strapi (создаёт user + JWT)
        await originalRegister(ctx);

        // Если регистрация не удалась — выходим (ошибка уже в ctx.response)
        const responseBody = ctx.response?.body || ctx.body;
        console.log('[auth.register] Response user id:', responseBody?.user?.id);

        if (!responseBody?.user?.id) {
          console.log('[auth.register] No user id in response, skipping role assignment');
          return;
        }

        const userId = responseBody.user.id;

        try {
          // 1. Находим целевую Strapi-роль
          let targetRole = await strapi
            .query('plugin::users-permissions.role')
            .findOne({ where: { type: userRole } });

          if (!targetRole) {
            const roleName = userRole.charAt(0).toUpperCase() + userRole.slice(1);
            targetRole = await strapi
              .query('plugin::users-permissions.role')
              .findOne({ where: { name: roleName } });
          }

          if (!targetRole) {
            console.warn(`[auth.register] Role not found for userRole=${userRole}, keeping default`);
          } else {
            console.log(`[auth.register] Found role: id=${targetRole.id}, name=${targetRole.name}, type=${targetRole.type}`);
          }

          // Fallback: если роль не найдена, используем authenticated
          const roleId = targetRole?.id || responseBody.user.role?.id;

          // 2. Обновляем user: userRole + fullName + phone + iin + правильная Strapi-роль
          await strapi.query('plugin::users-permissions.user').update({
            where: { id: userId },
            data: {
              userRole,
              fullName: fullName || null,
              phone: phone || null,
              iin: iin || null,
              role: roleId,
            },
          });

          console.log(`[auth.register] User ${userId} updated: userRole=${userRole}, roleId=${roleId}`);

          // 3. Если врач — создаём Doctor-профиль
          if (userRole === 'doctor') {
            const doctorProfileData: any = {
              fullName: fullName || '',
              users_permissions_user: userId,
              userId: userId,
              isActive: true,
              rating: 0,
              reviewsCount: 0,
              price: 8000,
              experience: doctorData?.experience ? parseInt(doctorData.experience) : 0,
              education: doctorData?.education || '',
              workStartTime: '09:00',
              workEndTime: '18:00',
              breakStart: '12:00',
              breakEnd: '14:00',
              slotDuration: 30,
              workingDays: '1,2,3,4,5',
            };

            if (doctorData?.specialization) {
              doctorProfileData.specialization = parseInt(doctorData.specialization);
            }

            const created = await strapi.documents('api::doctor.doctor').create({
              data: doctorProfileData,
              status: 'published',
            });

            console.log(`[auth.register] Doctor profile created: documentId=${created?.documentId}`);

            if (created?.documentId && !created?.publishedAt) {
              await strapi.documents('api::doctor.doctor').publish({
                documentId: created.documentId,
              });
            }
          }

          // 4. Обновляем response body, чтобы фронтенд получил актуальные данные
          responseBody.user.userRole = userRole;
          responseBody.user.fullName = fullName || null;
          responseBody.user.phone = phone || null;

          if (ctx.response?.body) {
            ctx.response.body = responseBody;
          } else {
            ctx.body = responseBody;
          }

          console.log('[auth.register] Registration complete');
        } catch (error) {
          console.error('[auth.register] Error during extended registration:', error);
        }
      },
    };
  };

  return plugin;
};
