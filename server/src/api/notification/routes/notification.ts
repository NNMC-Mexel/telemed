/**
 * Notification routes (default CRUD).
 * Custom endpoints see custom-notification.ts — Strapi loads both.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::notification.notification');
