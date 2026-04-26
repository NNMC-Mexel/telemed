import { errors } from '@strapi/utils';

const { ValidationError } = errors;

async function getExistingDoctor(documentId?: string) {
  if (!documentId) return null;
  return strapi.documents('api::doctor.doctor').findOne({
    documentId,
    fields: ['licenseNumber', 'isActive'],
  });
}

async function assertActiveDoctorHasLicense(data: any, documentId?: string) {
  const existing = await getExistingDoctor(documentId);
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
    await assertActiveDoctorHasLicense(event.params.data, event.params.where?.documentId);
  },
};
