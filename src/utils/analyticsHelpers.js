
import { DELAY_REASONS } from "./validators";

export const REASON_LABELS = {
  ...Object.fromEntries(DELAY_REASONS.map((r) => [r.value, r.label])),
  not_recorded: "Not recorded",
};

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dates

export function monthKeyOf(date = new Date()) {

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(key, opts = { month: "long", year: "numeric" }) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-ZA", opts);
}

export function daysInMonth(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

const pad2 = (n) => String(n).padStart(2, "0");
export const toYmd = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const parseYmd = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function rangePresets(today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = toYmd(t);
  return {
    this_month: {
      label: "This month",
      start: toYmd(new Date(t.getFullYear(), t.getMonth(), 1)),
      end,
    },
    last_month: {
      label: "Last month",
      start: toYmd(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
      end: toYmd(new Date(t.getFullYear(), t.getMonth(), 0)),
    },
    last_7: { label: "Last 7 days", start: toYmd(addDays(t, -6)), end },
    last_30: { label: "Last 30 days", start: toYmd(addDays(t, -29)), end },
    last_90: { label: "Last 90 days", start: toYmd(addDays(t, -89)), end },
    ytd: { label: "Year to date", start: `${t.getFullYear()}-01-01`, end },
  };
}


export function formatRange(start, end) {
  const s = parseYmd(start);
  const e = parseYmd(end);
  const fmt = (d, withYear) =>
    d.toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  if (
    start.slice(0, 7) === end.slice(0, 7) &&
    s.getDate() === 1 &&
    e.getDate() === daysInMonth(end.slice(0, 7))
  ) {
    return monthLabel(start.slice(0, 7));
  }
  if (start === end) return fmt(s, true);
  return s.getFullYear() === e.getFullYear()
    ? `${fmt(s, false)} – ${fmt(e, true)}`
    : `${fmt(s, true)} – ${fmt(e, true)}`;
}



function granularityFor(start, end) {
  const days = Math.round((parseYmd(end) - parseYmd(start)) / 86400000) + 1;
  if (days <= 45) return "day";
  if (days <= 200) return "week";
  return "month";
}

function bucketKeyFor(gran, dateStr) {
  if (gran === "day") return dateStr;
  if (gran === "month") return dateStr.slice(0, 7);
  const d = parseYmd(dateStr);
  return toYmd(addDays(d, -((d.getDay() + 6) % 7)));
}

function buildBuckets(start, end) {
  const gran = granularityFor(start, end);
  const multiYear = start.slice(0, 4) !== end.slice(0, 4);
  const buckets = [];
  const index = new Map();
  for (let d = parseYmd(start), last = parseYmd(end); d <= last; d = addDays(d, 1)) {
    const key = bucketKeyFor(gran, toYmd(d));
    if (index.has(key)) continue;
    index.set(key, buckets.length);
    const label =
      gran === "month"
        ? parseYmd(`${key}-01`).toLocaleDateString("en-ZA", {
            month: "short",
            ...(multiYear ? { year: "2-digit" } : {}),
          })
        : parseYmd(key).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
    buckets.push({
      key,
      label,
      title: gran === "week" ? `Week of ${label}` : label,
      onTime: 0,
      delayed: 0,
      cancelled: 0,
      delayMins: [],
    });
  }
  return { gran, buckets, index };
}



const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function isCancelled(a) {
  return !!a && a.status === "cancelled";
}

export function wasConfirmed(a) {
  if (!a) return false;
  return (
    a.status === "confirmed" ||
    a.status === "completed" ||
    a.statusBeforeDelay === "confirmed" ||
    !!a.confirmedAt
  );
}

export function delayOf(a) {
  if (!a) return null;
  const minutes = num(a.delayMinutes);
  if (minutes <= 0) return null;
  const history = Array.isArray(a.delayHistory) ? a.delayHistory : [];
  return {
    minutes,
    reason: a.delayReason || "not_recorded",
    note: a.delayNote || "",
    revisions: Math.max(history.length - 1, 0),
  };
}

export function patientLateOf(a) {
  if (!a) return null;
  const minutes = num(a.patientLateMinutes);
  return minutes > 0 ? minutes : null;
}

export function clientKeyOf(a) {
  if (!a) return "name:unknown";
  return (
    a.patientId ||
    (a.patientIdNumber ? `id:${a.patientIdNumber}` : "") ||
    `name:${(a.patientName || "unknown").trim().toLowerCase()}`
  );
}

const avg = (list) =>
  list.length ? list.reduce((s, n) => s + n, 0) / list.length : 0;
const pct = (part, whole) => (whole ? (part / whole) * 100 : 0);
export const round1 = (n) => Math.round(n * 10) / 10;


function summarise(appts, reviews, firstSeenByClient, range) {
  const safeAppts = (appts || []).filter(Boolean);
  const safeReviews = (reviews || []).filter(Boolean);
  const active = safeAppts.filter((a) => !isCancelled(a));
  const cancelled = safeAppts.length - active.length;
  const delays = active.map(delayOf).filter(Boolean);
  const lates = active.map(patientLateOf).filter(Boolean);

  const reasonCounts = {};
  const reasonMinutes = {};
  for (const d of delays) {
    reasonCounts[d.reason] = (reasonCounts[d.reason] || 0) + 1;
    reasonMinutes[d.reason] = (reasonMinutes[d.reason] || 0) + d.minutes;
  }
  const topReason =
    Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const clients = new Set(active.map(clientKeyOf));
  let newClients = 0;
  for (const key of clients) {
    const first = firstSeenByClient.get(key) || "";
    if (first >= range.start && first <= range.end) newClients += 1;
  }

  const rated = safeReviews.filter((r) => num(r.rating) > 0);

  return {
    booked: active.length,
    cancelled,
    cancellationRate: pct(cancelled, safeAppts.length),
    confirmed: active.filter(wasConfirmed).length,
    confirmationRate: pct(active.filter(wasConfirmed).length, active.length),
    completed: active.filter((a) => a.status === "completed").length,
    noShows: active.filter((a) => a.status === "no-show").length,
    uniqueClients: clients.size,
    newClients,
    returningClients: clients.size - newClients,
    delayedCount: delays.length,
    delayRate: pct(delays.length, active.length),
    avgDelay: avg(delays.map((d) => d.minutes)),
    maxDelay: delays.length ? Math.max(...delays.map((d) => d.minutes)) : 0,
    totalDelayMinutes: delays.reduce((s, d) => s + d.minutes, 0),
    reasonCounts,
    reasonMinutes,
    topReason,
    reasonRecorded: delays.filter((d) => d.reason !== "not_recorded").length,
    patientLateCount: lates.length,
    avgPatientLate: avg(lates),
    reviewCount: rated.length,
    avgRating: avg(rated.map((r) => num(r.rating))),
  };
}



export function buildReport({
  appointments,
  doctors,
  reviews,
  range,
  doctorId = "all",
}) {
  const safeAppointments = (appointments || []).filter(Boolean);
  const safeReviews = (reviews || []).filter(Boolean);
  const safeDoctors = (doctors || []).filter(Boolean);
  const doctorName = (id, fallback) =>
    safeDoctors.find((d) => d.id === id)?.name || fallback || "Unassigned";
  const inRange = (dateStr) =>
    !!dateStr && dateStr >= range.start && dateStr <= range.end;

  const firstSeenByClient = new Map();
  for (const a of safeAppointments) {
    if (isCancelled(a) || !a.date) continue;
    const key = clientKeyOf(a);
    const prev = firstSeenByClient.get(key);
    if (!prev || a.date < prev) firstSeenByClient.set(key, a.date);
  }

  const apptById = new Map(safeAppointments.map((a) => [a.id, a]));
  const visibleReviews = safeReviews.filter((r) => !r.hidden);
  const reviewDate = (r) => {
    const appt = apptById.get(r.appointmentId);
    if (appt?.date) return appt.date;
    return r.createdAt?.toDate ? toYmd(r.createdAt.toDate()) : "";
  };

  const inPeriod = safeAppointments.filter((a) => inRange(a.date));
  const scoped =
    doctorId === "all"
      ? inPeriod
      : inPeriod.filter((a) => (a.doctorId || "none") === doctorId);
  const reviewsIn = visibleReviews.filter(
    (r) =>
      inRange(reviewDate(r)) && (doctorId === "all" || r.doctorId === doctorId),
  );


  const doctorIds = [...new Set(inPeriod.map((a) => a.doctorId || "none"))];
  const perDoctor = doctorIds
    .map((id) => {
      const appts = inPeriod.filter((a) => (a.doctorId || "none") === id);
      const revs = visibleReviews.filter(
        (r) => inRange(reviewDate(r)) && r.doctorId === id,
      );
      return {
        id,
        name: doctorName(
          id === "none" ? null : id,
          appts.find((a) => a.doctorName)?.doctorName,
        ),
        ...summarise(appts, revs, firstSeenByClient, range),
      };
    })
    .sort((a, b) => b.booked - a.booked);

  const overall = summarise(scoped, reviewsIn, firstSeenByClient, range);

  const { gran, buckets, index } = buildBuckets(range.start, range.end);
  for (const a of scoped) {
    const bucket = buckets[index.get(bucketKeyFor(gran, a.date))];
    if (!bucket) continue;
    if (isCancelled(a)) bucket.cancelled += 1;
    else if (delayOf(a)) {
      bucket.delayed += 1;
      bucket.delayMins.push(delayOf(a).minutes);
    } else bucket.onTime += 1;
  }
  const perPeriod = buckets.map((b) => {
    const active = b.onTime + b.delayed;
    return {
      key: b.key,
      label: b.label,
      title: b.title,
      onTime: b.onTime,
      delayed: b.delayed,
      cancelled: b.cancelled,
      appointments: active,
      avgDelay: avg(b.delayMins),
      delayRate: pct(b.delayed, active),
    };
  });

  // Average delay
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const perWeekday = weekdayOrder.map((dow) => {
    const appts = scoped.filter(
      (a) => !isCancelled(a) && weekdayOf(a.date) === dow,
    );
    const delays = appts.map(delayOf).filter(Boolean);
    return {
      label: DAY_NAMES[dow],
      appointments: appts.length,
      delayed: delays.length,
      avgDelay: avg(delays.map((d) => d.minutes)),
    };
  });

  const reasons = Object.entries(overall.reasonCounts)
    .map(([value, count]) => ({
      value,
      label: REASON_LABELS[value] || value,
      count,
      minutes: overall.reasonMinutes[value] || 0,
    }))
    .sort((a, b) => b.count - a.count);

  const rows = scoped
    .slice()
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((a) => {
      const d = delayOf(a);
      return {
        id: a.id,
        date: a.date,
        time: a.time,
        doctor: doctorName(a.doctorId, a.doctorName),
        client: a.patientName || "",
        status:
          a.statusBeforeDelay && a.status === "delayed"
            ? `${a.statusBeforeDelay} (delayed)`
            : a.status || "",
        delayMinutes: d ? d.minutes : 0,
        delayReason: d ? REASON_LABELS[d.reason] || d.reason : "",
        delayNote: d ? d.note : "",
        patientLateMinutes: patientLateOf(a) || 0,
        confirmedVia: a.confirmedVia || "",
      };
    });

  return {
    overall,
    perDoctor,
    perPeriod,
    granularity: gran,
    perWeekday,
    reasons,
    rows,
  };
}

// CSV

function csvCell(value) {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function rowsToCsv(rows) {
  const headers = [
    ["date", "Date"],
    ["time", "Time"],
    ["doctor", "Doctor"],
    ["client", "Client"],
    ["status", "Status"],
    ["delayMinutes", "Doctor delay (min)"],
    ["delayReason", "Delay reason"],
    ["delayNote", "Delay note"],
    ["patientLateMinutes", "Patient late (min)"],
    ["confirmedVia", "Confirmed via"],
  ];
  const lines = [headers.map(([, h]) => csvCell(h)).join(",")];
  for (const r of rows) {
    lines.push(headers.map(([k]) => csvCell(r[k])).join(","));
  }
  return "\ufeff" + lines.join("\r\n");
}
