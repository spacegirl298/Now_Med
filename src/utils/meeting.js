// Online meeting links for virtual consultations.
//
// Each virtual appointment gets its own unguessable Jitsi Meet room
// (https://meet.jit.si - free, runs in the browser, no account or install
// needed for the patient or the doctor). The link is stored on the
// appointment as `meetingLink`, shown to the patient and the secretary, and
// included in the booking notification.

const ROOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomToken(length = 12) {
  const bytes = new Uint8Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => ROOM_ALPHABET[b % ROOM_ALPHABET.length]).join(
    "",
  );
}

export function generateMeetingLink() {
  return `https://meet.jit.si/NowMed-${randomToken(12)}`;
}

export function isVirtualAppointment(appointment) {
  return appointment?.type === "virtual";
}

// Only ever treat https links as joinable, so a bad value in the database can
// never turn into a javascript: or other scheme link.
//
// A virtual appointment saved without a link (older bookings, or one a
// secretary added before links existed) still gets a working one: the room
// name is derived from the appointment's own random ID, so the patient and
// the secretary both see the same link without anything needing to be saved.
export function safeMeetingLink(appointment) {
  const link = appointment?.meetingLink;
  if (typeof link === "string" && /^https:\/\//i.test(link)) return link;
  if (
    appointment?.type === "virtual" &&
    typeof appointment?.id === "string" &&
    /^[A-Za-z0-9]{10,}$/.test(appointment.id)
  ) {
    return `https://meet.jit.si/NowMed-${appointment.id}`;
  }
  return "";
}

// The join link is only offered close to the appointment: from
// JOIN_OPENS_MINUTES_BEFORE ahead of the start until JOIN_CLOSES_MINUTES_AFTER
// after it. This gates the button in the interface; it is not access control
// (the room itself is a public Jitsi room - see the README's limitations).
export const JOIN_OPENS_MINUTES_BEFORE = 10;
export const JOIN_CLOSES_MINUTES_AFTER = 60;

function appointmentStartMs(appointment) {
  const stamp = appointment?.appointmentAt;
  const start = stamp?.toDate
    ? stamp.toDate()
    : new Date(`${appointment?.date}T${appointment?.time}:00`);
  const ms = start.getTime();
  return Number.isFinite(ms) ? ms : null;
}

// -> { state: 'early' | 'open' | 'closed', opensAt: Date | null }
export function getJoinWindow(appointment, nowMs) {
  const startMs = appointmentStartMs(appointment);
  if (startMs === null) return { state: "open", opensAt: null };
  const opensMs = startMs - JOIN_OPENS_MINUTES_BEFORE * 60000;
  const closesMs = startMs + JOIN_CLOSES_MINUTES_AFTER * 60000;
  const state =
    nowMs < opensMs ? "early" : nowMs > closesMs ? "closed" : "open";
  return { state, opensAt: new Date(opensMs) };
}
