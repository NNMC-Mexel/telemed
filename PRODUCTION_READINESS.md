# Production Readiness Notes

## Release gates

- No tracked `.env` files: `node scripts/production-readiness-check.mjs`.
- `PAYMENTS_LIVE=true` on Strapi and signaling-server in production.
- PostgreSQL is required for production; SQLite is local development only.
- Strapi API token used by signaling-server must be scoped to server-to-server operations and rotated after every suspected leak.
- MinIO/S3 objects containing medical documents must be private; access goes through `/api/file-proxy/*`.

## Required infrastructure

- PostgreSQL with automated daily backups, point-in-time recovery if available, and a monthly restore drill.
- Redis is still recommended for Socket.io multi-instance scaling and slot reservations if signaling-server runs more than one replica.
- Centralized logs with retention, alerting on 5xx spikes, failed payment confirmations, failed appointment creation after paid status, and auth/rate-limit anomalies.
- TLS for all public domains and HSTS enabled.
- TURN credentials should be rotated regularly. Prefer ephemeral TURN credentials before broad public launch.

## Medical data controls

- Keep audit logs for registration consents, appointment changes, document access, document sharing, and admin actions.
- Confirm legal retention/deletion rules before enabling user-driven deletion/anonymization.
- Review privacy/terms versions whenever consent copy changes; update versions in `server/src/extensions/users-permissions/strapi-server.ts`.

## Manual smoke before production

Use `QA_SMOKE_CHECKLIST.md`, plus:

- Anonymous user cannot open a medical document URL.
- Patient can open only their own document URL.
- Doctor can open only documents linked/shared to their patients.
- Active doctor photo remains visible publicly.
- Paid QR/card payment creates exactly one appointment after page refresh and after signaling-server restart.
- Two users racing for the same slot: one succeeds, the other gets a conflict.
