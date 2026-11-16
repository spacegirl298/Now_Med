

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];


export function getTodayString() {
  return formatDate(new Date());
}

// Date formatting
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(dateStr) {
  const date = parseDate(dateStr);
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatShortDate(dateStr) {
  const date = parseDate(dateStr);
  return `${DAY_NAMES[date.getDay()].slice(0, 3)}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}

export function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

export function addMinutesToTime(timeStr, minutesToAdd) {
  const [h, m] = timeStr.split(":").map(Number);
  let totalMinutes = h * 60 + m + Number(minutesToAdd);
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const newH = Math.floor(totalMinutes / 60);
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function isToday(dateStr) {
  return dateStr === getTodayString();
}

export function isPastDate(dateStr) {
  return dateStr < getTodayString();
}

export function isPastSlot(dateStr, timeStr) {
  const slot = parseDate(dateStr);
  const [h, m] = timeStr.split(":").map(Number);
  slot.setHours(h, m, 0, 0);
  return slot.getTime() < Date.now();
}

export function generateTimeSlots(
  start = "08:00",
  end = "17:00",
  interval = 30,
) {
  const slots = [];
  let current = start;
  while (current < end) {
    slots.push(current);
    current = addMinutesToTime(current, interval);
  }
  return slots;
}

export function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - firstWeekday);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push({
      dateStr: formatDate(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    });
  }
  return days;
}

export function getMonthLabel(year, month) {
  return `${MONTH_NAMES[month]} ${year}`;
}

export function formatTimeAgo(timestamp) {
  if (!timestamp?.seconds) return "";
  const diffMs = Date.now() - timestamp.seconds * 1000;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function minutesSinceAppointment(appointment) {
  if (!appointment) return -Infinity;
  const start = appointment.appointmentAt?.toDate
    ? appointment.appointmentAt.toDate()
    : new Date(`${appointment.date}T${appointment.time}:00`);
  if (Number.isNaN(start.getTime())) return -Infinity;
  return (Date.now() - start.getTime()) / 60000;
}

export const REVIEW_PROMPT_DELAY_MINUTES = 15;

export function isReviewEligible(
  appointment,
  bufferMinutes = REVIEW_PROMPT_DELAY_MINUTES,
) {
  if (!appointment || appointment.status === "cancelled") return false;

  if (!appointment.date || !appointment.time) {
    return minutesSinceAppointment(appointment) >= bufferMinutes;
  }

  return minutesSinceAppointment(appointment) >= bufferMinutes;
}

export { DAY_NAMES, MONTH_NAMES };
