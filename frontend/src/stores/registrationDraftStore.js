import { create } from 'zustand'

const initialFormData = {
  fullName: '',
  email: '',
  phone: '',
  iin: '',
  password: '',
  confirmPassword: '',
  specialization: '',
  licenseNumber: '',
  experience: '',
  education: '',
  workplace: '',
}

const initialConsents = {
  personalData: false,
  medicalData: false,
  telemedicine: false,
  thirdPartyTransfer: false,
  termsAndPrivacy: false,
}

const resolveUpdater = (updater, currentValue) =>
  typeof updater === 'function' ? updater(currentValue) : updater

const useRegistrationDraftStore = create((set) => ({
  step: 1,
  formData: initialFormData,
  consents: initialConsents,

  setStep: (step) => set({ step }),
  setFormData: (updater) =>
    set((state) => ({
      formData: resolveUpdater(updater, state.formData),
    })),
  setConsents: (updater) =>
    set((state) => ({
      consents: resolveUpdater(updater, state.consents),
    })),
  resetDraft: () =>
    set({
      step: 1,
      formData: initialFormData,
      consents: initialConsents,
    }),
}))

export default useRegistrationDraftStore
