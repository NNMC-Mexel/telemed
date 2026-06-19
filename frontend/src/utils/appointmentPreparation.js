export const DOCUMENT_STATUS = {
  NOT_PROVIDED: 'not_provided',
  WILL_UPLOAD_LATER: 'will_upload_later',
  NO_DOCUMENTS: 'no_documents',
  UPLOADED: 'uploaded',
}

export const getAppointmentPreparation = (appointment = {}) => {
  const documentsStatus = appointment.patientDocumentsStatus || DOCUMENT_STATUS.NOT_PROVIDED
  const hasLinkedDocuments = Array.isArray(appointment.medical_documents) && appointment.medical_documents.length > 0
  const effectiveDocumentsStatus = hasLinkedDocuments && documentsStatus === DOCUMENT_STATUS.NOT_PROVIDED
    ? DOCUMENT_STATUS.UPLOADED
    : documentsStatus

  const documentsReady = [
    DOCUMENT_STATUS.UPLOADED,
    DOCUMENT_STATUS.NO_DOCUMENTS,
  ].includes(effectiveDocumentsStatus)
  const accessReady = effectiveDocumentsStatus === DOCUMENT_STATUS.NO_DOCUMENTS || appointment.doctorAccessGranted === true
  const readyCount = [documentsReady, accessReady].filter(Boolean).length
  const totalCount = 2

  let status = 'not_ready'
  if (effectiveDocumentsStatus === DOCUMENT_STATUS.NO_DOCUMENTS) {
    status = 'no_documents'
  } else if (documentsReady && accessReady) {
    status = 'ready'
  } else if (documentsReady) {
    status = 'access_missing'
  } else if (effectiveDocumentsStatus === DOCUMENT_STATUS.WILL_UPLOAD_LATER) {
    status = 'will_upload_later'
  }

  return {
    documentsStatus: effectiveDocumentsStatus,
    documentsReady,
    accessReady,
    readyCount,
    totalCount,
    status,
  }
}

export const buildPreparationPayload = ({
  selectedDocumentCount = 0,
  patientDocumentsStatus = DOCUMENT_STATUS.WILL_UPLOAD_LATER,
  doctorAccessGranted = true,
} = {}) => {
  const hasDocuments = selectedDocumentCount > 0
  const normalizedStatus = hasDocuments ? DOCUMENT_STATUS.UPLOADED : patientDocumentsStatus
  const noDocuments = normalizedStatus === DOCUMENT_STATUS.NO_DOCUMENTS
  const accessGranted = hasDocuments && doctorAccessGranted

  return {
    patientDocumentsStatus: normalizedStatus,
    doctorAccessGranted: accessGranted,
    preparationChecklist: {
      documentsReady: hasDocuments || noDocuments,
      doctorAccessGranted: accessGranted || noDocuments,
      selectedDocumentCount,
      noDocuments,
    },
  }
}
