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

export const APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'cancelled', 'delayed', 'no-show']
