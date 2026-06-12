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
 *   - doctorData больше не принимается из публичной регистрации.
 *
 * Автоматически:
 *   - Назначает Strapi-роль patient
 *   - Возвращает полные данные user в ответе
 *
 * В B2B-модели врачи создаются только администратором клиники через админ-панель.
 */
import crypto from 'crypto';
import { validatePassword } from './password-policy';

const sendConfirmationEmail = async (strapi: any, email: string, token: string) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:1342';
  const confirmUrl = `${frontendUrl}/email-confirmation?confirmation=${token}`;
  await strapi.plugin('email').service('email').send({
    to: email,
    subject: 'Подтверждение email — MedConnect',
    text: `Перейдите по ссылке для подтверждения вашего аккаунта: ${confirmUrl}\n\nСсылка действительна 24 часа.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#0d9488;padding:24px;text-align:center;border-radius:8px 8px 0 0;">
          <h1 style="color:white;margin:0;font-size:24px;">MedConnect</h1>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
          <h2 style="color:#1e293b;margin-top:0;">Подтверждение email</h2>
          <p style="color:#475569;">Здравствуйте! Нажмите на кнопку ниже, чтобы подтвердить ваш адрес электронной почты и активировать аккаунт:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${confirmUrl}"
               style="background:#0d9488;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
              Подтвердить email
            </a>
          </div>
          <p style="color:#94a3b8;font-size:13px;margin-bottom:0;">
            Если вы не регистрировались на платформе — просто проигнорируйте это письмо.<br/>
            Ссылка действительна в течение 24 часов.
          </p>
        </div>
      </div>
    `,
  });
};

export default (plugin) => {
  const LEGAL_DOCUMENT_VERSIONS = {
    terms: '2026-03-01',
    privacy: '2026-03-01',
    consent: '2026-05-06',
  };

  const REQUIRED_CONSENTS = [
    'personalData',
    'medicalData',
    'telemedicine',
    'thirdPartyTransfer',
    'termsAndPrivacy',
  ];
  const EMAIL_CONFIRMATION_TTL_HOURS = 24;

  const truncate = (value: unknown, maxLength: number) => {
    if (!value) return null;
    return String(value).slice(0, maxLength);
  };

  const getClientIp = (ctx: any) => {
    const forwardedFor = ctx.request?.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }
    return ctx.ip || ctx.request?.ip || ctx.request?.socket?.remoteAddress || null;
  };

  const hasRequiredConsents = (consents: any) =>
    consents && REQUIRED_CONSENTS.every((name) => consents[name] === true);

  const normalizeKazakhstanPhone = (value: unknown) => {
    const raw = String(value || '');
    let digitsOnly = raw.replace(/\D/g, '');
    if (!digitsOnly) return null;

    if (raw.trim().startsWith('+7')) {
      digitsOnly = digitsOnly.slice(1);
      if (digitsOnly[0] === '8') digitsOnly = digitsOnly.slice(1);
      if (digitsOnly.length > 10 && digitsOnly[0] === '7') digitsOnly = digitsOnly.slice(1);
    } else if (digitsOnly[0] === '8') {
      digitsOnly = digitsOnly.slice(1);
    } else if (digitsOnly.length > 10 && digitsOnly[0] === '7') {
      digitsOnly = digitsOnly.slice(1);
    }

    const localDigits = digitsOnly.slice(0, 10);

    if (localDigits.length !== 10) return null;

    return `+7 ${localDigits.slice(0, 3)} ${localDigits.slice(3, 6)}-${localDigits.slice(6, 8)}-${localDigits.slice(8, 10)}`;
  };

  const sanitizeUser = (strapi: any, user: any, ctx: any) => {
    const userSchema = strapi.getModel('plugin::users-permissions.user');
    return strapi.contentAPI.sanitize.output(user, userSchema, { auth: ctx.state?.auth });
  };

  const issueUserJwt = (strapi: any, userId: number | string) =>
    strapi.plugin('users-permissions').service('jwt').issue({ id: userId });

  const resolveLoginIdentifier = async (strapi: any, sourceBody: any) => {
    const identifier = String(sourceBody?.identifier || '').trim();
    if (!identifier) return identifier;

    const digitsOnly = identifier.replace(/\D/g, '');
    const isPhone = digitsOnly.length >= 7 && /^[\d\s\+\-\(\)]+$/.test(identifier);
    if (!isPhone) return identifier;

    const localDigits = digitsOnly.slice(-10);
    const phoneCandidates: string[] = [identifier];
    const normalizedPhone = normalizeKazakhstanPhone(identifier);
    if (normalizedPhone && !phoneCandidates.includes(normalizedPhone)) {
      phoneCandidates.push(normalizedPhone);
    }
    if (localDigits.length === 10) {
      [
        `+7${localDigits}`,
        `7${localDigits}`,
        `8${localDigits}`,
        localDigits,
      ].forEach((phoneVariant) => {
        if (!phoneCandidates.includes(phoneVariant)) phoneCandidates.push(phoneVariant);
      });
    }

    for (const phoneVariant of phoneCandidates) {
      const foundUser = await strapi.query('plugin::users-permissions.user').findOne({
        where: { phone: phoneVariant },
        select: ['id', 'email', 'phone'],
      });
      if (foundUser?.email) {
        console.log('[auth.callback] Phone login: found user by phone, using email');
        return foundUser.email;
      }
    }

    return identifier;
  };

  const blockUnconfirmedUser = async (strapi: any, ctx: any, identifier: string) => {
    if (!identifier) return false;

    const userToCheck = await strapi.query('plugin::users-permissions.user').findOne({
      where: { email: identifier.toLowerCase() },
      select: ['id', 'confirmed'],
    });

    if (userToCheck && userToCheck.confirmed === false) {
      ctx.status = 400;
      ctx.body = {
        error: {
          status: 400,
          name: 'ValidationError',
          message: 'email_not_confirmed',
        },
      };
      return true;
    }

    return false;
  };

  // Сохраняем оригинальную factory-функцию контроллера auth
  const originalAuthFactory = plugin.controllers.auth;

  // Заменяем на новую factory, которая оборачивает оригинальную
  plugin.controllers.auth = (factoryContext) => {
    // Вызываем оригинальную factory, чтобы получить все методы контроллера
    const originalController = originalAuthFactory(factoryContext);
    const originalRegister = originalController.register;
    const originalCallback = originalController.callback;
    const originalForgotPassword = originalController.forgotPassword;
    const originalResetPassword = originalController.resetPassword;
    const originalChangePassword = originalController.changePassword;

    return {
      ...originalController,

      // Strapi routes POST /auth/local to auth.callback, not auth.login.
      // Resolve phone identifiers and block unconfirmed users before issuing JWT.
      async callback(ctx) {
        const requestBody = ctx.request?.body || {};
        const sourceBody =
          requestBody?.data && typeof requestBody.data === 'object'
            ? requestBody.data
            : requestBody;

        if ((ctx.params?.provider || 'local') !== 'local') {
          return originalCallback(ctx);
        }

        const resolvedIdentifier = await resolveLoginIdentifier(strapi, sourceBody);
        if (resolvedIdentifier && resolvedIdentifier !== sourceBody?.identifier) {
          ctx.request.body = { ...sourceBody, identifier: resolvedIdentifier };
        }
        if (await blockUnconfirmedUser(strapi, ctx, resolvedIdentifier)) {
          return;
        }

        return originalCallback(ctx);
      },

      async emailConfirmation(ctx) {
        const confirmationToken = String(ctx.query?.confirmation || '').trim();
        if (!confirmationToken) {
          ctx.status = 400;
          ctx.body = {
            error: {
              status: 400,
              name: 'ValidationError',
              message: 'confirmation is a required field',
            },
          };
          return;
        }

        const user = await strapi.query('plugin::users-permissions.user').findOne({
          where: { confirmationToken },
        });

        if (!user) {
          ctx.status = 400;
          ctx.body = {
            error: {
              status: 400,
              name: 'ValidationError',
              message: 'Invalid token',
            },
          };
          return;
        }

        if (user.confirmationTokenExpiresAt && new Date(user.confirmationTokenExpiresAt) <= new Date()) {
          ctx.status = 400;
          ctx.body = {
            error: {
              status: 400,
              name: 'ValidationError',
              message: 'Confirmation token expired',
            },
          };
          return;
        }

        const updatedUser = await strapi.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: { confirmed: true, confirmationToken: null, confirmationTokenExpiresAt: null },
        });

        ctx.body = {
          jwt: issueUserJwt(strapi, user.id),
          user: await sanitizeUser(strapi, updatedUser, ctx),
        };
      },

      async sendEmailConfirmation(ctx) {
        const email = String(ctx.request?.body?.email || '').trim().toLowerCase();
        if (!email) {
          ctx.status = 400;
          ctx.body = {
            error: {
              status: 400,
              name: 'ValidationError',
              message: 'email is a required field',
            },
          };
          return;
        }

        const user = await strapi.query('plugin::users-permissions.user').findOne({
          where: { email },
          select: ['id', 'email', 'confirmed', 'blocked'],
        });

        if (!user) {
          ctx.body = { email, sent: true };
          return;
        }
        if (user.confirmed) {
          ctx.status = 400;
          ctx.body = {
            error: {
              status: 400,
              name: 'ApplicationError',
              message: 'Already confirmed',
            },
          };
          return;
        }
        if (user.blocked) {
          ctx.status = 400;
          ctx.body = {
            error: {
              status: 400,
              name: 'ApplicationError',
              message: 'User blocked',
            },
          };
          return;
        }

        const confirmationToken = crypto.randomBytes(32).toString('hex');
        const confirmationTokenExpiresAt = new Date(
          Date.now() + EMAIL_CONFIRMATION_TTL_HOURS * 60 * 60 * 1000,
        ).toISOString();
        await strapi.query('plugin::users-permissions.user').update({
          where: { id: user.id },
          data: { confirmationToken, confirmationTokenExpiresAt },
        });
        await sendConfirmationEmail(strapi, user.email, confirmationToken);

        ctx.body = {
          email: user.email,
          sent: true,
        };
      },

      async forgotPassword(ctx) {
        const email = String(ctx.request?.body?.email || '').trim().toLowerCase();
        if (!email) {
          ctx.status = 400;
          ctx.body = { error: { status: 400, name: 'ValidationError', message: 'email is a required field' } };
          return;
        }

        const user = await strapi.query('plugin::users-permissions.user').findOne({
          where: { email },
          select: ['id', 'email', 'blocked'],
        });

        if (!user) {
          ctx.body = { ok: true };
          return;
        }

        if (user.blocked) {
          ctx.body = { ok: true };
          return;
        }

        return originalForgotPassword(ctx);
      },

      // Reset via emailed token — enforce the password policy before Strapi
      // hashes and stores the new password (QA BUG-01).
      async resetPassword(ctx) {
        const requestBody = ctx.request?.body || {};
        const sourceBody =
          requestBody?.data && typeof requestBody.data === 'object'
            ? requestBody.data
            : requestBody;

        const passwordCheck = validatePassword(sourceBody?.password);
        if (!passwordCheck.valid) {
          return ctx.badRequest(passwordCheck.message, { code: passwordCheck.code });
        }

        return originalResetPassword(ctx);
      },

      // Change password for an authenticated user — same policy applies.
      async changePassword(ctx) {
        const requestBody = ctx.request?.body || {};
        const sourceBody =
          requestBody?.data && typeof requestBody.data === 'object'
            ? requestBody.data
            : requestBody;

        const passwordCheck = validatePassword(sourceBody?.password);
        if (!passwordCheck.valid) {
          return ctx.badRequest(passwordCheck.message, { code: passwordCheck.code });
        }

        return originalChangePassword(ctx);
      },

      async register(ctx) {
        console.log('[auth.register] Custom registration handler started');

        // 0. Извлекаем дополнительные поля и УБИРАЕМ из body,
        //    иначе Strapi-валидация отклонит запрос: "Invalid parameters"
        const requestBody = ctx.request?.body || {};
        const sourceBody =
          requestBody?.data && typeof requestBody.data === 'object'
            ? requestBody.data
            : requestBody;

        const { userRole: rawRole, fullName, phone, iin, doctorData, consents, ...cleanBody } = sourceBody;

        // B2B security: public registration is only for patients.
        // Doctors are clinic employees and must be created/verified by an admin.
        const normalizedRole = typeof rawRole === 'string' ? rawRole.toLowerCase() : null;
        if (normalizedRole === 'doctor' || normalizedRole === 'admin' || doctorData) {
          return ctx.forbidden('Doctor registration is disabled. Doctors are created by clinic administrators.');
        }
        if (!hasRequiredConsents(consents)) {
          return ctx.badRequest('All required medical and personal data consents must be accepted.');
        }

        // Server-side password policy — the client check can be bypassed by
        // calling the API directly (QA BUG-01).
        const passwordCheck = validatePassword(cleanBody.password);
        if (!passwordCheck.valid) {
          return ctx.badRequest(passwordCheck.message, { code: passwordCheck.code });
        }

        const normalizedPhone = normalizeKazakhstanPhone(phone);
        if (!normalizedPhone) {
          return ctx.badRequest('Phone must be a valid Kazakhstan number in +7 format.');
        }

        // Uniqueness checks — phone and IIN must be unique across all users
        const existingByPhone = await strapi.query('plugin::users-permissions.user').findOne({
          where: { phone: normalizedPhone },
          select: ['id'],
        });
        if (existingByPhone) {
          return ctx.badRequest('phone_already_registered');
        }

        if (iin) {
          const existingByIin = await strapi.query('plugin::users-permissions.user').findOne({
            where: { iin: String(iin).trim() },
            select: ['id'],
          });
          if (existingByIin) {
            return ctx.badRequest('iin_already_registered');
          }
        }

        const userRole = 'patient';

        console.log(`[auth.register] userRole=${userRole}, fullName=${fullName}`);

        // Strip non-standard fields from the body so Strapi's allowedFields
        // validation doesn't reject them. We mutate the EXISTING object (not
        // just replace the reference) because originalRegister may hold a
        // closure over the same object reference in Strapi v5 / Koa.
        const EXTRA_KEYS = ['userRole', 'fullName', 'phone', 'iin', 'doctorData', 'consents'];
        const bodyRef = ctx.request.body as Record<string, unknown>;
        for (const key of EXTRA_KEYS) {
          delete bodyRef[key];
        }
        // Also reassign as a fallback for environments where the setter matters.
        ctx.request.body = { ...cleanBody };

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

        let createdDoctorDocId: string | undefined;

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
            // Hard fail — assigning the wrong role (authenticated) is a security risk
            throw new Error(`Role '${userRole}' not found in Strapi. Check roles configuration.`);
          }

          console.log(`[auth.register] Found role: id=${targetRole.id}, name=${targetRole.name}, type=${targetRole.type}`);

          const roleId = targetRole.id;

          // 2. Обновляем user: userRole + fullName + phone + iin + правильная Strapi-роль
          const confirmationToken = crypto.randomBytes(32).toString('hex');
          const confirmationTokenExpiresAt = new Date(
            Date.now() + EMAIL_CONFIRMATION_TTL_HOURS * 60 * 60 * 1000,
          ).toISOString();

          await strapi.query('plugin::users-permissions.user').update({
            where: { id: userId },
            data: {
              userRole,
              fullName: fullName || null,
              phone: normalizedPhone,
              iin: iin || null,
              role: roleId,
              confirmed: false,
              confirmationToken,
              confirmationTokenExpiresAt,
            },
          });

          console.log(`[auth.register] User ${userId} updated: userRole=${userRole}, roleId=${roleId}`);

          const updatedUser = await strapi.query('plugin::users-permissions.user').findOne({
            where: { id: userId },
            select: ['id', 'documentId'],
          });

          await strapi.documents('api::consent-record.consent-record').create({
            data: {
              user: updatedUser?.documentId,
              source: 'registration',
              personalDataConsent: true,
              medicalDataConsent: true,
              telemedicineConsent: true,
              thirdPartyTransferConsent: true,
              termsAndPrivacyConsent: true,
              consentVersion: LEGAL_DOCUMENT_VERSIONS.consent,
              termsVersion: LEGAL_DOCUMENT_VERSIONS.terms,
              privacyVersion: LEGAL_DOCUMENT_VERSIONS.privacy,
              locale: truncate(consents.locale, 16),
              ipAddress: truncate(getClientIp(ctx), 64),
              userAgent: truncate(ctx.request?.headers?.['user-agent'], 1024),
              acceptedAt: new Date().toISOString(),
            },
          });

          strapi.log.info(JSON.stringify({
            audit: 'USER_CONSENTS_ACCEPTED',
            userId,
            source: 'registration',
            versions: LEGAL_DOCUMENT_VERSIONS,
            ts: new Date().toISOString(),
          }));

          // 3. Отправляем письмо с подтверждением
          try {
            await sendConfirmationEmail(strapi, responseBody.user.email, confirmationToken);
            console.log(`[auth.register] Confirmation email sent to ${responseBody.user.email}`);
          } catch (emailErr) {
            const emailMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
            console.error('[auth.register] Failed to send confirmation email:', emailMsg);
            // Не блокируем регистрацию — пользователь сможет запросить повторную отправку
          }

          // 4. Убираем JWT — пользователь должен сначала подтвердить email
          const pendingResponse = {
            pendingConfirmation: true,
            user: {
              id: userId,
              email: responseBody.user.email,
              userRole,
              fullName: fullName || null,
            },
          };

          if (ctx.response?.body) {
            ctx.response.body = pendingResponse;
          } else {
            ctx.body = pendingResponse;
          }

          // Audit log — registration
          strapi.log.info(JSON.stringify({
            audit: 'USER_REGISTERED',
            userId,
            userRole,
            ts: new Date().toISOString(),
          }));

          console.log('[auth.register] Registration complete');
        } catch (error) {
          const safeMessage = error instanceof Error ? error.message : String(error);
          console.error('[auth.register] Error during extended registration — rolling back user:', safeMessage);

          // Rollback: remove the partially-created doctor profile and user so the
          // client can safely retry. The JWT was only written to ctx.body (not flushed),
          // so we can still overwrite the response before Strapi sends it.
          if (createdDoctorDocId) {
            try {
              await strapi.documents('api::doctor.doctor').delete({ documentId: createdDoctorDocId });
              console.log(`[auth.register] Rolled back doctor profile ${createdDoctorDocId}`);
            } catch (deleteErr) {
              const deleteMsg = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
              console.error('[auth.register] Failed to rollback doctor profile:', deleteMsg);
            }
          }
          try {
            await strapi.query('plugin::users-permissions.user').delete({ where: { id: userId } });
            console.log(`[auth.register] Rolled back user ${userId}`);
          } catch (deleteErr) {
            const deleteMsg = deleteErr instanceof Error ? deleteErr.message : String(deleteErr);
            console.error('[auth.register] Failed to rollback user:', deleteMsg);
          }

          ctx.status = 500;
          ctx.body = {
            error: {
              status: 500,
              name: 'InternalServerError',
              message: 'Registration failed due to a server error. Please try again.',
            },
          };
        }
      },
    };
  };

  return plugin;
};
