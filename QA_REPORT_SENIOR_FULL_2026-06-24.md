# Senior QA Report — MedConnect (full A→Z)

**Дата:** 2026-06-24
**Инженер:** Senior QA (Claude)
**Окружение:** local dev — Strapi `http://localhost:1340`, signaling `http://localhost:1341`, frontend (Vite) `http://localhost:1342`
**Стек:** Strapi 5 (SQLite) + React 19 / Vite 7 + WebRTC signaling
**Роли (тестовые учётки, пароль `QaTest!2026`):**
- patient — `qa_senior_patient_1780741939714@test.kz`
- doctor — `qa_senior_doctor_1780741939714@test.kz`
- admin — `qa_senior_admin_1780741939714@test.kz`

> Пароли тройки QA-аккаунтов были сброшены на известный, удовлетворяющий серверной политике, для воспроизводимого прогона. На реальные пользовательские данные это не влияет.

---

## Executive Summary

Проведён полный end-to-end прогон по трём ролям: статический анализ/сборки, API + RBAC/IDOR матрица (37 кейсов), браузерный E2E на реальном Chrome (Playwright, 19 страниц), а также сквозная проверка новых фич: **акции/промо, скидочное ценообразование, создание пользователей админом, пагинация админ-списков**.

**Критических функциональных блокеров в ядре ролей не найдено.** Ownership/scoping на записях работает, чужие записи отдают 403, пациент/доктор не получают `/api/users`, доктор не может создавать запись, пациент не может подделать цену или `paymentStatus`, промо-CRUD доступен только админу, привилегий-эскалация пациента заблокирована, политика паролей и отключение саморегистрации врачей соблюдаются. Промо→скидка работает сквозняком и корректно откатывается.

Открытые дефекты/риски перед production:

| ID | Severity | Область | Резюме |
|---|---:|---|---|
| BUG-01 | High | Security / Dependencies | `server npm audit --omit=dev` — 1 high (`undici` через Strapi: HTTP header injection / WS DoS) + 40 moderate (цепочка `firebase-admin`) |
| BUG-02 | Medium | Frontend/API permissions | Авторизованные patient/doctor получают **403** на `GET /api/global?populate=*` — axios цепляет Bearer к публичному content-endpoint (регрессия из отчёта 2026-06-23, всё ещё открыта) |
| BUG-03 | Low-Med | Privacy | `GET /api/auth/check-email?email=…` отдаёт `{"exists":true\|false}` — энумерация email. **Смягчено** rate-limit 5/15мин/IP + фикс. задержка 300мс, но булев флаг по-прежнему раскрывается |
| BUG-04 | Low | UX / i18n | Топ-бар страницы `/admin/promotions` показывает `Страница` вместо «Акции»: в `dashboard.page_titles` нет ключей `/admin/promotions` и `_sub` (во всех трёх локалях) |
| BUG-05 | Low | Performance | Главный бандл `index-*.js` 1.07 MB (270 KB gzip), нет code-splitting — предупреждение Vite о размере чанка |
| BUG-06 | Low | Code quality | Frontend ESLint: 29 warnings (hooks deps, set-state-in-effect) |

Динамика к отчёту 2026-06-23: BUG-01(prev) email enumeration — **смягчён** (rate-limit + timing), переведён в Low-Med; BUG-02(prev undici) — **остаётся**; BUG-03(prev /api/global) — **остаётся**; BUG-04(prev CORS 127.0.0.1) — не воспроизводился в этом прогоне (тест шёл на `localhost`); добавлены проверки новых фич.

---

## 1. Static / Build / Tooling

| Проверка | Результат |
|---|---|
| `frontend npm run build` | ✅ Passed (chunk-size warning, см. BUG-05) |
| `frontend npm run lint` | ⚠️ 0 errors, 29 warnings (BUG-06) |
| `frontend npm run test:consultation-flow` | ✅ 6/6 passed |
| `server npm run build` (`strapi build`) | ✅ Passed (exit 0) |
| i18n JSON parse ru/en/kk | ✅ Passed |
| i18n key parity ru/en/kk | ✅ 1539 ключей в каждой локали, расхождений нет |
| `frontend npm audit --omit=dev` | ✅ 0 vulnerabilities |
| `server npm audit --omit=dev --audit-level=high` | ❌ 46 vulns (5 low, 40 moderate, **1 high**) — BUG-01 |
| Health: Strapi `/_health` 204, signaling `/health` 200, vite `/` 200 | ✅ |

---

## 2. API + RBAC / IDOR Matrix

Скрипт: [qa-artifacts/api-matrix.mjs](qa-artifacts/api-matrix.mjs) · результаты: [qa-artifacts/api-matrix-results.json](qa-artifacts/api-matrix-results.json)
**Итог: 36/37 авто-pass; единственный «fail» — неполный payload теста (без обязательного `role`), вручную перепроверено — создание юзера админом работает (201 → login 200 → delete 200).**

### Auth / identity
| Кейс | Ожид. | Факт |
|---|---:|---:|
| login patient / doctor / admin | 200 | ✅ |
| `users/me` не отдаёт `password` (все роли) | 200, no pw | ✅ |
| weak password `123` при регистрации | 400 | ✅ |
| password без заглавной | 400 | ✅ |
| саморегистрация врача отключена | 403 | ✅ |

### RBAC
| Кейс | Ожид. | Факт |
|---|---:|---:|
| `GET /api/users` patient / doctor | 403 | ✅ |
| `GET /api/users` admin | 200 | ✅ |
| `GET /api/users` anon | 401/403 | ✅ (403) |
| `POST /api/users` patient / doctor | 401/403 | ✅ (403) |
| `POST /api/users` admin (с `role`) | 201 | ✅ + новый юзер логинится + удаляется |
| patient `PUT /api/users/:id` (role escalation) | заблок. | ✅ (403) |
| `GET/POST /api/promotions` patient / doctor | 403 | ✅ |
| `GET /api/promotions` admin | 200 | ✅ |

### Записи / IDOR / ценообразование
| Кейс | Ожид. | Факт |
|---|---:|---:|
| список записей patient / doctor / admin | 200 | ✅ |
| список записей anon | 401/403 | ✅ |
| doctor создаёт запись | 403 | ✅ |
| patient: `price=1`, `discountAmount=999999`, `paymentStatus=paid` | 400/403 | ✅ (400) |
| IDOR: patient сканирует чужие записи id 1..40 | нет 200-утечки | ✅ (40×403) |
| patient видит только свои записи | own only | ✅ (2 свои) |
| medical-documents / conversations коды доступа (patient) | 200/403/404 | ✅ |
| anon upload | 401/403/400 | ✅ |

> Примечание: в авто-скрипте кейс «check-email privacy» дал ложный PASS (тестировал POST → 405). Реальный endpoint — `GET /api/auth/check-email`, см. BUG-03.

---

## 3. Новые фичи — сквозная проверка

### 3.1 Акции / скидочное ценообразование (промо)
End-to-end через API (admin):
1. Базовая цена врача (anon `GET /api/doctors`): `price=8000, effectivePrice=8000, discount=0`.
2. Админ создаёт акцию `scope=all, discountType=percentage, discountValue=25, isActive=true, badgeLabel="-25%"` → **201**.
3. Anon-каталог сразу отражает скидку: `price=8000, effectivePrice=6000, discountAmount=2000, badge="-25%"` ✅
4. Подделка цены пациентом при бронировании отклоняется (см. матрицу) — серверная валидация против канонической цены врача ✅
5. Удаление акции (admin) → **204**, каталог откатывается к `effectivePrice=8000, discount=0` ✅

**Вердикт:** промо-логика (`server/src/utils/promotions.ts` → `attachPromotionPricing`) корректна и безопасна; цена считается сервером, клиент её не диктует.

### 3.2 Создание пользователей админом
`POST /api/users` admin-only: patient/doctor → 403; admin с `role` → 201; созданный юзер логинится; удаление 200. RBAC и lifecycle корректны.

### 3.3 Пагинация админ-списков
Новый компонент [frontend/src/components/ui/Pagination.jsx](frontend/src/components/ui/Pagination.jsx) подключён в `AdminUsers`, `AdminDoctors`, `AdminAppointments`. Страницы рендерятся без runtime/console-ошибок (см. E2E).

---

## 4. Browser E2E (Playwright + системный Chrome)

Скрипт: [qa-artifacts/e2e.mjs](qa-artifacts/e2e.mjs) · результаты: [qa-artifacts/e2e/e2e-results.json](qa-artifacts/e2e/e2e-results.json) · скриншоты: [qa-artifacts/e2e/](qa-artifacts/e2e/)
Реальный логин через форму для каждой роли, обход всех страниц роли, захват: console errors, uncaught page errors, сетевые ответы ≥400, blank-детект, full-page скриншоты.

**Итог: 19 страниц / 3 роли — blanks=0, pageErrors=0, consoleErrors=0, failedRequests=0.**

| Роль | Маршруты (все ✅, без ошибок) |
|---|---|
| Patient | `/patient`, `/patient/doctors`, `/patient/appointments`, `/patient/chat`, `/patient/documents`, `/patient/profile` |
| Doctor | `/doctor`, `/doctor/schedule`, `/doctor/patients`, `/doctor/chat`, `/doctor/profile` |
| Admin | `/admin`, `/admin/users`, `/admin/doctors`, `/admin/promotions`*, `/admin/appointments`, `/admin/specializations`, `/admin/support`, `/admin/settings` |

\* контент рендерится корректно («Акции», «Добавить акцию», «Список акций (0)»), но топ-бар показывает `Страница` — **BUG-04**.

Доп. проверка доступа: anon `/patient` → редирект на `/login?redirect=%2Fpatient` ✅.

Визуально подтверждено по скриншотам: каталог врачей с ценами/бейджами, дашборды, формы, списки — без визуальных поломок.

---

## 5. Детализация дефектов

### BUG-01 — High — server prod-зависимости
`cd server && npm audit --omit=dev --audit-level=high` → **1 high**: `undici` (HTTP header injection via Set-Cookie percent-decoding; WS DoS via fragment count bypass) приходит транзитивно через Strapi; плюс 40 moderate из цепочки `firebase-admin → @google-cloud/storage → teeny-request/retry-request/uuid`.
**Действие:** обновить Strapi до версии с пропатченным `undici`; для firebase-admin — обновить мажор или вынести push-уведомления за пределы прод-критичного пути. Зафиксировать прохождение `scripts/production-readiness-check.mjs` как гейт релиза.

### BUG-02 — Medium — 403 на публичном `/api/global` для авторизованных
`GET /api/global?populate=*` с Bearer токеном patient/doctor → **403** (роли patient/doctor не имеют `global.find`, а axios-интерсептор всегда добавляет токен). Anon — 200. Приводит к ложным «Network/permission» ошибкам в UI и лишним 403 в логах.
**Действие:** либо не слать Authorization на публичные content-эндпоинты, либо выдать ролям patient/doctor `find` на `global`.

### BUG-03 — Low-Med — email enumeration через check-email
`GET /api/auth/check-email?email=…` → `{"exists":true}` для существующего, `{"exists":false}` для отсутствующего. Смягчено: rate-limit 5 запросов/15 мин/IP (in-memory) и фиксированная задержка 300 мс против timing-атак (`server/src/api/check-email/controllers/check-email.ts`). Остаточный риск перечисления пользователей сохраняется (нужно для UX «email уже зарегистрирован»).
**Действие:** принять как осознанный trade-off ИЛИ перейти на единый необъявляющий ответ + проверку через письмо; rate-limit перевести на общий стор (Redis) для multi-instance.

### BUG-04 — Low — заголовок «Страница» на /admin/promotions
`dashboard.page_titles` не содержит `/admin/promotions` и `/admin/promotions_sub` → `DashboardLayout` падает в `default = "Страница"` (см. `frontend/src/components/layout/DashboardLayout.jsx:22`). Во всех трёх локалях.
**Действие:** добавить ключи `/admin/promotions` = «Акции» и `_sub` в ru/en/kk.

### BUG-05 — Low — размер бандла
`dist/assets/index-*.js` 1.07 MB (gzip 270 KB), Vite предупреждает (>950 KB). Нет route-level code-splitting.
**Действие:** `React.lazy`/dynamic import для админских и консультационных модулей.

### BUG-06 — Low — ESLint warnings
29 warnings: `react-hooks/exhaustive-deps`, `react-hooks/set-state-in-effect` (включая `SupportInbox.jsx`, документы). Риск незаметных багов рендера/гонок.
**Действие:** причесать зависимости эффектов; включить как CI-гейт после фикса.

---

## 6. Что НЕ покрыто (ограничения прогона)

- **Видео-консультация (WebRTC/TURN) в реальном времени** между двумя браузерами — проверены health сигналинга и серверная авторизация `can-join`, но peer-to-peer медиа-сессия не прогонялась (нужны два синхронных клиента + TURN).
- **Платёжный шлюз (ePay, `VITE_EPAY_TEST=true`)** — серверная защита `paymentStatus`/цены проверена; реальный редирект на эквайринг не выполнялся.
- **Email-доставка** (SMTP yandex) — отправка писем подтверждения/сброса не верифицировалась на реальном ящике.
- **Мобильные сборки (Capacitor android/ios, push)** — вне scope этого web-прогона; см. отдельный `MOBILE_ALERTS_QA_REPORT.md`.
- **Нагрузочное/конкурентное** бронирование слотов (race conditions) — точечно покрыто (`slot-conflicts`), полноценный стресс не делался.

## 7. Рекомендация

Ядро ролей (patient/doctor/admin), RBAC, IDOR, ценообразование и новые фичи (промо/создание юзеров/пагинация) — **готовы**. Перед production устранить **BUG-01 (High, зависимости)** — это релизный гейт; BUG-02 и BUG-04 — быстрые фиксы, желательно до релиза. Остальное (BUG-03/05/06) — в ближайший бэклог.

---

### Артефакты прогона
- API-матрица: `qa-artifacts/api-matrix.mjs`, `qa-artifacts/api-matrix-results.json`
- E2E-скрипт + результаты + скриншоты: `qa-artifacts/e2e.mjs`, `qa-artifacts/e2e/`
