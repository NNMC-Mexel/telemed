import { errors } from '@strapi/utils';

const { ValidationError } = errors;

function getScalarValue(value: any) {
  if (value && typeof value === 'object') {
    return value.$eq ?? value.eq ?? null;
  }

  return value ?? null;
}

async function getExistingDoctor(where?: any) {
  if (!where) return null;

  const documentId = getScalarValue(where.documentId);
  if (documentId) {
    return strapi.db.query('api::doctor.doctor').findOne({
      where: { documentId: String(documentId) },
      select: ['licenseNumber', 'isActive'],
    });
  }

  const id = getScalarValue(where.id);
  if (id) {
    return strapi.db.query('api::doctor.doctor').findOne({
      where: { id },
      select: ['licenseNumber', 'isActive'],
    });
  }

  return null;
}

async function assertActiveDoctorHasLicense(data: any, where?: any) {
  const existing = await getExistingDoctor(where);
  const merged = {
    licenseNumber: (existing as any)?.licenseNumber,
    isActive: (existing as any)?.isActive,
    ...data,
  };

  const willBeActive = merged?.isActive !== false;
  if (willBeActive && !String(merged?.licenseNumber || '').trim()) {
    throw new ValidationError('licenseNumber is required for active doctors');
  }
}

export default {
  async beforeCreate(event) {
    await assertActiveDoctorHasLicense(event.params.data);
  },

  async beforeUpdate(event) {
    await assertActiveDoctorHasLicense(event.params.data, event.params.where);
  },
};
