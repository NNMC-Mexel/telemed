# Senior QA Report — MedConnect

Дата: 2026-06-23  
Окружение: local dev, Strapi `http://localhost:1340`, signaling `http://localhost:1341`, frontend `http://localhost:1343`  
Роли: пациент `qa_f5_patient@test.kz`, доктор `test@mail.ru`, админ `qa_senior_admin_1780741939714@test.kz`

## Executive Summary

Проверены основные end-to-end сценарии пациента, доктора и администратора: авторизация, роутинг, каталоги, дашборды, записи, документы, расписание, пациенты, админские списки, RBAC/IDOR, серверная политика паролей, сборка и audit.

Критических функциональных блокеров в ядре ролей не найдено: ownership на записях работает, чужие записи блокируются, пациент/доктор не получают `/api/users`, доктор не может создавать запись за пациента, пациент не может передать произвольный `paymentStatus`.

Есть дефекты и риски перед production:

| ID | Severity | Area | Summary |
|---|---:|---|---|
| BUG-01 | High | Privacy | `/api/auth/check-email` раскрывает существование email через `exists:true/false` |
| BUG-02 | High | Security / Dependencies | `server npm audit --omit=dev --audit-level=high` падает из-за `undici < 6.27.0` через Strapi |
| BUG-03 | Medium | Frontend/API permissions | Авторизованные patient/doctor получают `403` на `/api/global?populate=*`, потому что axios добавляет Bearer token к публичному content endpoint |
| BUG-04 | Medium | Local/dev config | Если открыть frontend как `127.0.0.1`, API на `localhost:1340` блокируется CORS, появляются массовые `Network Error` |
| BUG-05 | Low-Med | Code quality | Frontend lint: 29 warnings по hooks dependencies и setState-in-effect |
| BUG-06 | Low | UX/i18n consistency | Админские формы показывают разные требования к паролю: часть текстов говорит минимум 6 символов, сервер требует 8 + uppercase/lowercase/digit/special |

## What Was Tested

### Build / Static / Tooling

| Check | Result |
|---|---|
| `frontend npm run build` | Passed |
| `frontend npm run lint` | Passed with 29 warnings |
| `frontend npm run test:consultation-flow` | Passed, 6/6 |
| `server npm run build` | Passed |
| translation JSON parse ru/en/kk | Passed |
| signaling `/health` | Passed |
| `scripts/production-readiness-check.mjs` | Failed: server audit high vulnerability |

### API / RBAC Matrix

| Case | Expected | Actual |
|---|---:|---:|
| patient login | 200 | Passed |
| doctor login | 200 | Passed |
| admin login | 200 | Passed |
| anonymous doctors catalog | 200 | Passed |
| anonymous specializations | 200 | Passed |
| `/users/me` does not expose password for patient/doctor/admin | 200, no password | Passed |
| patient `GET /api/users` | 403 | Passed |
| doctor `GET /api/users` | 403 | Passed |
| admin `GET /api/users` | 200 | Passed |
| patient appointments list | 200 | Passed |
| doctor appointments list | 200 | Passed |
| admin appointments list | 200 | Passed |
| patient fetch foreign appointment | 403/404 | Passed |
| doctor fetch foreign appointment | 403/404 | Passed |
| doctor create appointment | 403 | Passed |
| patient invalid `paymentStatus` | 400 | Passed |
| patient/doctor create promotion | 403 | Passed |
| admin get promotions | 200 | Passed |
| weak password registration `123` | 400 | Passed |
| valid password registration | 200 pending confirmation | Passed |

### UI Routes

Checked desktop routes:

- Anonymous: `/doctors`, `/login`, `/patient` redirect to login.
- Patient: `/patient`, `/patient/appointments`, `/patient/doctors`, `/patient/chat`, `/patient/documents`, `/patient/profile`.
- Doctor: `/doctor`, `/doctor/schedule`, `/doctor/patients`, `/doctor/chat`, `/doctor/profile`.
- Admin: `/admin`, `/admin/users`, `/admin/doctors`, `/admin/appointments`, `/admin/specializations`, `/admin/settings`, `/admin/support`.
- Mobile viewport: patient dashboard and appointments.

Result: no blank screens on tested routes. With canonical `localhost` origin, patient/doctor/admin pages loaded expected data. Public doctors catalog showed 12 doctors. Admin appointments showed 71 records.

Artifacts:

- `qa-artifacts/ui-results.json` — first run via `127.0.0.1`, useful for CORS reproduction.
- `qa-artifacts/ui-results-localhost.json` — canonical run via `localhost`.
- `qa-artifacts/*.png` — screenshots from the first UI run.

## Findings

### BUG-01 — Email Enumeration via `/api/auth/check-email`

Severity: High  
Priority: High

Steps:

1. `GET /api/auth/check-email?email=qa_f5_patient@test.kz`
2. `GET /api/auth/check-email?email=no-such-seniorqa@test.kz`

Actual:

- Existing email returns `{"exists":true}`.
- Missing email returns `{"exists":false}`.

Impact:

An attacker can enumerate registered emails. This conflicts with safer forgot-password behavior.

Recommendation:

Return a uniform response, for example `{ "ok": true }`, and move availability checks to a post-submit registration flow. If UX requires pre-check, protect it with CAPTCHA/rate limits and avoid direct `exists` semantics.

### BUG-02 — Server Audit Fails on High Vulnerability

Severity: High  
Priority: High

Command:

```bash
npm audit --omit=dev --audit-level=high
```

Actual:

Fails with `undici` high advisory via `@strapi/core`: WebSocket DoS, fixed in `undici >= 6.27.0`. Audit reports 1 high, 40 moderate, 5 low.

Recommendation:

Upgrade/override affected dependency path safely. Current Strapi packages are `5.48.1`, while audit suggests odd fix metadata around `5.48.0`; verify lockfile resolution and consider an explicit `undici` override only after Strapi compatibility testing.

### BUG-03 — Authenticated Users Get 403 on Public Global Content

Severity: Medium  
Priority: Medium

Steps:

1. Login as patient or doctor.
2. Request `/api/global?populate=*` with Bearer token.

Actual:

- Anonymous: `200`
- Admin: `200`
- Patient: `403`
- Doctor: `403`

Cause:

Axios interceptor attaches Bearer token to every request. Strapi then evaluates `global.find` using patient/doctor role, but those roles do not have global permission.

Impact:

Authenticated patient/doctor pages log 403 errors when components load landing/global content. If a page depends on that content instead of fallback config, content can break for logged-in users.

Recommendation:

Either grant read-only `api::global.global.find/findOne` and `api::about.about.find/findOne` to patient/doctor roles, or call public content endpoints with an axios instance that does not attach Authorization.

### BUG-04 — 127.0.0.1 vs localhost CORS Footgun

Severity: Medium  
Priority: Medium

Steps:

1. Run frontend on `127.0.0.1:1343`.
2. API base remains `http://localhost:1340`.
3. Open authenticated pages.

Actual:

Browser blocks preflight: no `Access-Control-Allow-Origin` for origin `http://127.0.0.1:1343`; UI shows `Network Error`.

Impact:

Local QA/dev can produce false negatives and broken authenticated flows if frontend URL uses `127.0.0.1` while API uses `localhost`.

Recommendation:

Allow both localhost and 127.0.0.1 dev origins in Strapi CORS config, or make frontend/API hostnames consistent in `.env` and docs.

### BUG-05 — React Hooks / Effect Warnings

Severity: Low-Med  
Priority: Medium

`npm run lint` reports 29 warnings, mostly:

- missing hook dependencies in chat/support/video/dashboard/pages;
- synchronous `setState` inside effects.

Impact:

Risk of stale closures, duplicate fetches, missed refreshes and hard-to-reproduce UI state bugs.

Recommendation:

Fix by module, starting with chat/support/video consultation and dashboards because those are stateful real-time flows.

### BUG-06 — Password Requirement Copy Is Inconsistent

Severity: Low  
Priority: Low-Med

Server policy correctly requires 8 chars + uppercase/lowercase/digit/special. Some admin doctor/user copy still says minimum 6 chars.

Impact:

Admin may enter a password that UI copy implies is valid but server rejects.

Recommendation:

Unify all password copy and constants against `frontend/src/utils/helpers.js` and server `password-policy.ts`.

## Role Verdicts

### Patient

Passed:

- Login/session routing.
- Dashboard loads stats and widgets.
- Appointments list loads own records.
- Doctors catalog loads and booking entry points are visible.
- Documents empty state and upload entry point render.
- Cannot access foreign appointment.
- Cannot access `/api/users`.
- Cannot create promotion.
- Invalid payment status rejected server-side.

Risks:

- 403 console noise from `/api/global` for authenticated patient.
- Mobile route renders, but detailed touch interaction/booking payment flow still needs real device or full browser automation.

### Doctor

Passed:

- Login/session routing.
- Doctor dashboard loads schedule/reviews.
- Schedule loads slots.
- Patients list loads only related patients.
- Cannot access `/api/users`.
- Cannot create appointment as doctor.
- Cannot access foreign appointment.
- Cannot create promotion.

Risks:

- 403 console noise from `/api/global` for authenticated doctor.
- Video/WebRTC needs full two-browser camera/mic test on staging.

### Admin

Passed:

- Login/session routing.
- Dashboard shows users/doctors/appointments/revenue.
- Users, doctors, appointments, specializations, content and support routes render.
- Admin can access `/api/users`.
- Admin appointments list loads 71 records.

Risks:

- Audit blocker remains.
- Admin password/update copy inconsistent with server policy.

## Not Fully Covered

- Real Halyk/ePay card and QR payments with sandbox credentials.
- Real email delivery and confirmation link in mailbox.
- Actual camera/microphone WebRTC call between two real browser sessions.
- Push notifications on iOS/Android.
- File upload malware/content scanning beyond frontend/server guards.
- Accessibility audit with screen reader tooling.
- Load/concurrency test for slot reservation and appointment creation.

## Recommendation Before Production

1. Fix `check-email` enumeration.
2. Resolve server audit high vulnerability.
3. Fix authenticated `/api/global` permission/token behavior.
4. Normalize dev CORS for `localhost` and `127.0.0.1`.
5. Clean high-risk hook warnings in chat/support/video flows.
6. Run staging E2E with real payment sandbox, email, WebRTC and mobile devices.
