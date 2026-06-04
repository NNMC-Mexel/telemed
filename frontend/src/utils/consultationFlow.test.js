import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CONSULTATION_EXIT_REASON,
  buildPatientRatingPayload,
  shouldShowPatientRating,
} from './consultationFlow.js'

test('patient local leave does not show rating modal', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'patient',
      exitReason: CONSULTATION_EXIT_REASON.LOCAL_LEAVE,
    }),
    false,
  )
})

test('doctor force end shows rating modal to patient', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'patient',
      exitReason: CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END,
    }),
    true,
  )
})

test('doctor never sees patient rating modal', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'doctor',
      exitReason: CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END,
    }),
    false,
  )
})

test('rating modal is not shown repeatedly after it was already prompted', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'patient',
      exitReason: CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END,
      hasPromptedRating: true,
    }),
    false,
  )
})

test('rating modal is not shown after patient already selected a rating', () => {
  assert.equal(
    shouldShowPatientRating({
      userRole: 'patient',
      exitReason: CONSULTATION_EXIT_REASON.DOCTOR_FORCE_END,
      hasSubmittedRating: true,
    }),
    false,
  )
})

test('patient rating payload does not include forbidden status fields', () => {
  assert.deepEqual(
    buildPatientRatingPayload({ rating: 5, reviewText: '  good consultation  ' }),
    { rating: 5, review: 'good consultation' },
  )
  assert.equal('status' in buildPatientRatingPayload({ rating: 5 }), false)
  assert.equal('statuse' in buildPatientRatingPayload({ rating: 5 }), false)
})
