/**
 * Doctor controller.
 * find/findOne — публичные (управляется permissions роли).
 * update — только свой профиль (policy на route).
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::doctor.doctor');
