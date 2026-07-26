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

export function isNotEmpty(value) {
  return String(value || '').trim().length > 0
}

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