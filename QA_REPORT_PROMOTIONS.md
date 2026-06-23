# QA Report: Promotions / Discounts

Date: 2026-06-23
Scope: MedConnect promotion MVP for doctor prices, admin CRUD, patient-facing display, appointment price lock, and payment integration.

## Summary

Status: Passed with residual environment limitations.

During QA, 3 implementation defects were found and fixed:

1. Specialization-scoped promotions could display on a doctor but fail direct appointment creation because appointment price validation loaded the doctor without populated specialization.
2. 100% / zero-tenge effective prices could be displayed, but appointment/payment flows reject zero amounts.
3. Some card payment paths stored the paid discounted amount but did not persist the promotion snapshot into the appointment.

All fixes were rechecked with build/syntax/lint checks.

## Verified Coverage

### Backend Promotion Rules

Covered:
- Active promotion filtering by `isActive`.
- Date window filtering by `startsAt` / `endsAt`.
- Scope matching:
  - all consultations;
  - selected doctors;
  - selected specializations.
- Discount types:
  - percentage;
  - fixed amount;
  - fixed price.
- Priority behavior:
  - higher `priority` wins;
  - if priority is equal, lower effective price wins.
- Non-beneficial promotions are ignored.
- Zero-tenge effective prices are ignored because current payment/appointment flow requires a positive amount.

Files checked:
- `server/src/utils/promotions.ts`
- `server/src/api/promotion/content-types/promotion/schema.json`
- `server/src/api/promotion/controllers/promotion.ts`

### Admin CRUD

Covered:
- Admin-only route and controller protection.
- Promotion creation/update/delete API wiring.
- Admin UI route `/admin/promotions`.
- Form validation:
  - title required;
  - discount value > 0;
  - percentage limited to 1-99%;
  - doctor scope requires at least one doctor;
  - specialization scope requires at least one specialization;
  - end date must be after start date.

Files checked:
- `frontend/src/pages/admin/AdminPromotions.jsx`
- `frontend/src/services/api.js`
- `frontend/src/App.jsx`
- `frontend/src/utils/constants.js`
- `server/src/index.ts`

### Patient Price Display

Covered:
- Doctor card shows old price struck through and effective price.
- Doctor profile shows old price, badge, percentage, and effective price.
- Booking modal uses `effectivePrice` for displayed total and payment amount.

Files checked:
- `frontend/src/components/doctors/DoctorCard.jsx`
- `frontend/src/pages/DoctorProfilePage.jsx`
- `frontend/src/components/appointments/BookingModal.jsx`
- `frontend/src/utils/helpers.js`

### Appointment Price Lock

Covered:
- Appointment creation validates against canonical server-side effective price.
- `originalPrice`, `discountAmount`, and `promotionSnapshot` are stored on appointment.
- For gateway-created paid appointments, previously locked paid amount is accepted to avoid stranded captured payments.
- Specialization-scoped promotions now work in appointment validation because doctor is loaded with specialization.

Files checked:
- `server/src/api/appointment/controllers/appointment.ts`
- `server/src/api/appointment/content-types/appointment/schema.json`

### Payment Integration

Covered:
- Halyk QR token creation uses server-side `effectivePrice`.
- Card/ePay token creation uses server-side `effectivePrice`.
- Payment intent stores:
  - amount;
  - originalAmount;
  - discountAmount;
  - promotionSnapshot in metadata.
- QR status flow creates appointment with promotion snapshot.
- Card redirect confirm creates appointment with promotion snapshot.
- Card webhook creates appointment with promotion snapshot.
- QR/card recoveries preserve snapshot from persisted payment intent.

Files checked:
- `signaling-server/server.js`
- `server/src/api/payment-intent/content-types/payment-intent/schema.json`

## Executed Checks

Commands:

```bash
cd server && npm run build
cd frontend && npm run build
cd signaling-server && node --check server.js
cd frontend && npm run lint
git diff --check
curl -I --max-time 5 http://127.0.0.1:1342/
```

Results:
- Server build: passed.
- Frontend build: passed.
- Signaling syntax check: passed.
- Diff whitespace check: passed.
- Frontend dev server HTTP check: 200 OK.
- Frontend lint: 0 errors, 29 warnings. Warnings are existing hook/style warnings across unrelated files; no promo-specific lint errors.

## Not Fully Executed

Browser/UI E2E was attempted but not available in this session:
- Browser plugin target list returned empty.
- No visual screenshot verification could be taken.

Live gateway E2E was not executed:
- No real Halyk/ePay sandbox credentials/session were used.
- Payment coverage is static/control-flow QA plus syntax/build verification.

Admin authenticated CRUD E2E was not executed:
- No admin test credentials were available in the current environment.

## Residual Risks

1. Fixed-amount discounts larger than a doctor's price are accepted by admin UI/API but ignored at runtime because they would produce a zero/negative amount. This is safer than showing an unbookable free appointment, but admin UX could be improved later with doctor-aware warnings.
2. Admin promotions page text is currently Russian-only, while the nav label is localized. This is acceptable for internal admin MVP but should be localized if admins use Kazakh/English UI.
3. Real payment reconciliation should be smoke-tested on staging with sandbox credentials before production deploy.
4. Existing frontend lint warnings remain outside this feature scope.

## Recommendation

Ready for staging QA with seeded admin, doctor, specialization, and payment sandbox data.

Minimum staging scenarios:
1. Create 50% doctor promotion for a 5000 ₸ doctor and verify 2500 ₸ display in list, profile, booking modal.
2. Book test appointment and verify appointment stores `price=2500`, `originalPrice=5000`, `discountAmount=2500`.
3. Create specialization promotion and verify booking succeeds for a doctor in that specialization.
4. Create expired, future, inactive, and lower-priority promotions and verify they do not override the active expected promotion.
5. Run Halyk QR/card sandbox payment and verify paid appointment snapshot matches payment intent snapshot.
