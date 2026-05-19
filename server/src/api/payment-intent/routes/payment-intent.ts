/**
 * payment-intent router
 *
 * Not granted to public/user roles. Used by server-to-server API token calls
 * from signaling-server for durable payment idempotency.
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::payment-intent.payment-intent' as any);
