// Online meeting links for virtual consultations.
//
// Each virtual appointment gets its own unguessable Jitsi Meet room
// (https://meet.jit.si - free, runs in the browser, no account or install
// needed for the patient or the doctor). The link is stored on the
// appointment as `meetingLink`, shown to the patient and the secretary, and
// included in the booking notification.

const ROOM_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

function randomToken(length = 12) {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join('')
}

export function generateMeetingLink() {
  return `https://meet.jit.si/NowMed-${randomToken(12)}`
}

export function isVirtualAppointment(appointment) {
  return appointment?.type === 'virtual'
}

// Only ever treat https links as joinable, so a bad value in the database can
// never turn into a javascript: or other scheme link.
export function safeMeetingLink(appointment) {
  const link = appointment?.meetingLink
  return typeof link === 'string' && /^https:\/\//i.test(link) ? link : ''
}
