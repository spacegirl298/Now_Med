// Date & time helpers shared across the app.
// Dates are stored/passed around as 'YYYY-MM-DD' strings.
// Times are stored/passed around as 24hr 'HH:MM' strings.

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

// 'YYYY-MM-DD' for today, in local time (avoids UTC off-by-one issues)
export function getTodayString() {
  return formatDate(new Date())
}

// Date object -> 'YYYY-MM-DD'
export function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 'YYYY-MM-DD' -> Date object (local midnight, not UTC)
export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 'YYYY-MM-DD' -> 'Monday, 30 March 2026'
export function formatDisplayDate(dateStr) {
  const date = parseDate(dateStr)
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
}

// 'YYYY-MM-DD' -> 'Mon, 30 March'
export function formatShortDate(dateStr) {
  const date = parseDate(dateStr)
  return `${DAY_NAMES[date.getDay()].slice(0, 3)}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`
}

// 'HH:MM' (24hr) -> '10:30 AM'
export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h % 12 === 0 ? 12 : h % 12
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`
}

// Add minutes to a 'HH:MM' time string, returns new 'HH:MM' (wraps within a day)
export function addMinutesToTime(timeStr, minutesToAdd) {
  const [h, m] = timeStr.split(':').map(Number)
  let totalMinutes = h * 60 + m + Number(minutesToAdd)
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440
  const newH = Math.floor(totalMinutes / 60)
  const newM = totalMinutes % 60
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`
}

export function isToday(dateStr) {
  return dateStr === getTodayString()
}

// True if the given 'YYYY-MM-DD' date is strictly before today (local time).
// Used to block new bookings on past dates while still allowing that day's
// existing appointments to be viewed.
export function isPastDate(dateStr) {
  return dateStr < getTodayString()
}

// True if the given date+time is already in the past
export function isPastSlot(dateStr, timeStr) {
  const slot = parseDate(dateStr)
  const [h, m] = timeStr.split(':').map(Number)
  slot.setHours(h, m, 0, 0)
  return slot.getTime() < Date.now()
}

// Generate time slots between start and end (24hr strings) at a given interval in minutes
export function generateTimeSlots(start = '08:00', end = '17:00', interval = 30) {
  const slots = []
  let current = start
  while (current < end) {
    slots.push(current)
    current = addMinutesToTime(current, interval)
  }
  return slots
}

// Build a 6-week (42-day) calendar grid for a given month, starting on Monday.
// Each cell is { dateStr, inMonth } so days from adjacent months can be dimmed.
export function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  // getDay(): 0 = Sunday ... 6 = Saturday. We want Monday-first grids.
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - firstWeekday)

  const days = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    days.push({
      dateStr: formatDate(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    })
  }
  return days
}

export function getMonthLabel(year, month) {
  return `${MONTH_NAMES[month]} ${year}`
}

export function greetingForNow() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export { DAY_NAMES, MONTH_NAMES }