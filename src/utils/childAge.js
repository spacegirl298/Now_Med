// Age, life-stage and ID helpers for family (child) profiles.
// Dates are 'YYYY-MM-DD' strings in local time, same convention as dateHelpers.js.

// South Africa's Children's Act: a child of 12+ with enough maturity can
// consent to their own treatment; full legal capacity starts at 18.
export const CONSENT_AGE = 12
export const MAJORITY_AGE = 18
// How early the parent and child are warned that the hand-over is coming.
export const NOTICE_MONTHS = 6

const pad2 = (n) => String(n).padStart(2, '0')
export const toYmd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

export function parseYmd(str) {
  const [y, m, d] = String(str).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Whole years completed on `today`.
export function ageOn(dob, today = new Date()) {
  const b = parseYmd(dob)
  let age = today.getFullYear() - b.getFullYear()
  const hadBirthday =
    today.getMonth() > b.getMonth() ||
    (today.getMonth() === b.getMonth() && today.getDate() >= b.getDate())
  if (!hadBirthday) age -= 1
  return age
}

// "Newborn", "8 months", "9 years"
export function formatAge(dob, today = new Date()) {
  const years = ageOn(dob, today)
  if (years >= 2) return `${years} years`
  const b = parseYmd(dob)
  const months =
    (today.getFullYear() - b.getFullYear()) * 12 +
    today.getMonth() -
    b.getMonth() -
    (today.getDate() < b.getDate() ? 1 : 0)
  if (months < 1) return 'Newborn'
  return `${months} month${months === 1 ? '' : 's'}`
}

// The date a person reaches `years` of age.
export function dateAtAge(dob, years) {
  const b = parseYmd(dob)
  return new Date(b.getFullYear() + years, b.getMonth(), b.getDate())
}

export function daysUntil(date, today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((date.getTime() - t.getTime()) / 86400000)
}

// 'child' (0-11) | 'teen' (12-17) | 'adult' (18+)
export function ageTier(dob, today = new Date()) {
  const age = ageOn(dob, today)
  if (age >= MAJORITY_AGE) return 'adult'
  if (age >= CONSENT_AGE) return 'teen'
  return 'child'
}

// 'none' | 'notice' (final 6 months before 18) | 'ready' (18 or older)
export function transitionStage(dob, today = new Date()) {
  const turns18 = dateAtAge(dob, MAJORITY_AGE)
  if (today >= turns18) return 'ready'
  const noticeStart = new Date(turns18)
  noticeStart.setMonth(noticeStart.getMonth() - NOTICE_MONTHS)
  return today >= noticeStart ? 'notice' : 'none'
}

// True while a parent may still manage this profile.
export function isManageable(child, today = new Date()) {
  if (!child?.dateOfBirth) return false
  return ageOn(child.dateOfBirth, today) < MAJORITY_AGE
}

// ---------- South African ID numbers ----------

// Standard Luhn check, which SA ID numbers satisfy.
export function isValidSaIdChecksum(id) {
  if (!/^\d{13}$/.test(id)) return false
  let sum = 0
  for (let i = 0; i < 13; i++) {
    let digit = Number(id[12 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

// The first six digits are YYMMDD. A child is never more than 18, so any
// two-digit year that would land in the future belongs to the 1900s.
export function dobFromSaId(id) {
  if (!/^\d{13}$/.test(id)) return null
  const yy = Number(id.slice(0, 2))
  const mm = Number(id.slice(2, 4))
  const dd = Number(id.slice(4, 6))
  let year = 2000 + yy
  if (year > new Date().getFullYear()) year -= 100
  const d = new Date(year, mm - 1, dd)
  if (d.getMonth() !== mm - 1 || d.getDate() !== dd) return null
  return toYmd(d)
}