// Shared validation helpers.

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim())
}

export function isValidPassword(password) {
  return String(password || '').length >= 6
}

export function isValidName(name) {
  return String(name || '').trim().length >= 2
}

export function isValidPhone(phone) {
  if (!phone) return true // optional field
  return /^[0-9+\s()-]{7,15}$/.test(phone)
}

// Digits only (with optional spaces/dashes, since some schemes print numbers
// like "1234 5678" or "1234-5678"). Used for fields like medical aid number
// that should be numeric but aren't phone numbers, so don't need +()  etc.
export function isValidMedicalAidNumber(value) {
  if (!value) return true // optional field
  return /^[0-9\s-]{4,20}$/.test(value)
}

// Generic "digits only" check for any free-text box that should only ever
// contain numbers. Empty is treated as valid so it composes with
// "optional field" patterns elsewhere — pair with isNotEmpty if a field is
// also required.
export function isNumeric(value) {
  if (value === '' || value === null || value === undefined) return true
  return /^[0-9]+$/.test(String(value))
}

export function isNotEmpty(value) {
  return String(value || '').trim().length > 0
}

// Options for the gender dropdown, shown on the secretary's patient overview
// edit form (PatientRecordModal.jsx). Kept as { value, label } so the value
// stored in Firestore is a stable slug even if the label copy changes later.
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
]

// Delay durations offered when a secretary marks an appointment as running late
export const DELAY_OPTIONS = [10, 20, 30, 45]

export const APPOINTMENT_TYPES = ['in-person', 'virtual']

// 'booked' = on the calendar but the patient hasn't confirmed yet.
// 'confirmed' = the practice confirmed attendance with the patient.
// 'scheduled' is kept only so older records saved before this change still
// render with a sensible badge — new appointments should use 'booked'.
export const APPOINTMENT_STATUSES = ['booked', 'confirmed', 'scheduled', 'cancelled', 'delayed', 'no-show']

// How a secretary confirmed an appointment with a patient.
export const CONFIRMATION_METHODS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Phone call' },
  { value: 'email', label: 'Email' },
]