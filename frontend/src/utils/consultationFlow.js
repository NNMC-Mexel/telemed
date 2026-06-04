export const CONSULTATION_EXIT_REASON = {
  LOCAL_LEAVE: 'local_leave',
  DOCTOR_FORCE_END: 'doctor_force_end',
}

export const shouldShowPatientRating = ({
  userRole,
  exitReason,
  hasPromptedRating = false,
  hasSubmittedRating = false,
}) => {
  return (
    userRole === 'patient' &&
    exitReason === CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END &&
    !hasPromptedRating &&
    !hasSubmittedRating
  )
}

export const buildPatientRatingPayload = ({ rating, reviewText = '' }) => {
  const payload = { rating }
  const review = reviewText.trim()
  if (review) payload.review = review
  return payload
}
