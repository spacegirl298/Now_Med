// Sample data for the analytics page's "Demo data" switch. Built in memory
// each time (nothing is written to Firestore) and shaped exactly like real
// appointments, doctors and reviews, so every chart and table works on it.
//
// It is deterministic - the same seed always gives the same pattern - and it
// tells a small story so the graphs have something to show:
//   Dr Naidoo  - often runs over, but improving month by month; Mondays worst
//   Dr Smith   - rarely late
//   Dr Mokoena - emergencies cause delays, mostly Tuesdays and Thursdays
// Statuses match what the app produces today: confirmed, booked (not yet
// confirmed), delayed and cancelled.

const FIRST = [
  "Thabo", "Naledi", "Sipho", "Ayesha", "Johan", "Lerato", "Pieter", "Zanele",
  "Fatima", "Kagiso", "Megan", "Themba", "Priya", "Ruan", "Nomsa", "Daniel",
  "Chantal", "Bongani", "Aisha", "Willem", "Palesa", "Imran", "Lindiwe",
  "Kyle", "Refilwe", "Sarah", "Mandla", "Thandi", "Yusuf", "Annelie",
];
const LAST = [
  "Nkosi", "Van der Merwe", "Dlamini", "Patel", "Botha", "Mokoena", "Naidoo",
  "Khumalo", "Pretorius", "Sithole", "Moosa", "Molefe", "Jacobs", "Mahlangu",
  "Smith", "Ndlovu", "Coetzee", "Mthembu", "Govender", "Radebe",
];
const TIMES = [];
for (let h = 8; h <= 16; h += 1) {
  TIMES.push(`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`);
}
const NOTES = {
  previous_overran: ["Complex consult before this one", "Previous patient needed extra time"],
  emergency: ["Emergency walk-in", "Urgent referral came in"],
  procedure: ["Minor procedure took longer than planned"],
  doctor_late: ["Doctor stuck in traffic", "Hospital rounds ran late"],
  admin_system: ["Booking system was down", "Records not loading"],
  other: ["Running behind"],
};

const DOCTORS = [
  {
    id: "mock-d1",
    name: "Dr Naidoo",
    specialty: "General practitioner",
    // delay chance per month, oldest -> newest (12 months; the "improving" story)
    rates: [0.4, 0.4, 0.38, 0.38, 0.36, 0.34, 0.32, 0.28, 0.24, 0.2, 0.18, 0.17],
    dow: { 1: 1.6 },
    reasons: { previous_overran: 0.55, emergency: 0.15, procedure: 0.15, admin_system: 0.1, other: 0.05 },
    rating: 4.2,
  },
  {
    id: "mock-d2",
    name: "Dr Smith",
    specialty: "Family medicine",
    rates: [0.08, 0.07, 0.09, 0.06, 0.08, 0.07, 0.07, 0.09, 0.06, 0.08, 0.07, 0.06],
    dow: {},
    reasons: { doctor_late: 0.4, admin_system: 0.3, previous_overran: 0.3 },
    rating: 4.7,
  },
  {
    id: "mock-d3",
    name: "Dr Mokoena",
    specialty: "Paediatrics",
    rates: [0.22, 0.24, 0.21, 0.23, 0.2, 0.22, 0.24, 0.21, 0.23, 0.2, 0.22, 0.21],
    dow: { 2: 1.7, 4: 1.7 },
    reasons: { emergency: 0.5, procedure: 0.3, previous_overran: 0.2 },
    rating: 4.4,
  },
];

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted(rand, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

const ymd = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function generateMockAnalyticsData(now = new Date(), months = 12) {
  const rand = mulberry32(2026);
  const todayStr = ymd(now);
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // A growing client base: some clients are already known at the start, and
  // new ones keep joining, so "new vs returning" is realistic every month.
  const clients = Array.from({ length: 1200 }, (_, i) => ({
    name: `${FIRST[i % FIRST.length]} ${LAST[(Math.floor(i / FIRST.length) + i * 3) % LAST.length]}`,
    // About 7 in 10 have an app account; the rest are walk-ins booked by ID.
    patientId: i % 10 < 7 ? `mock-p${i}` : null,
    patientIdNumber: `MOCK-${i}`,
  }));
  let knownClients = 40;

  const appointments = [];
  const reviews = [];
  let n = 0;

  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  for (let day = new Date(start); ymd(day) <= todayStr; day.setDate(day.getDate() + 1)) {
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue; // closed weekends
    const monthIndex =
      (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
    const dateStr = ymd(day);

    for (const doc of DOCTORS) {
      const count = 4 + Math.floor(rand() * 4); // 4-7 appointments a day
      const slots = [...TIMES].sort(() => rand() - 0.5).slice(0, count).sort();

      for (const time of slots) {
        n += 1;
        const client =
          rand() < 0.14 && knownClients < clients.length
            ? clients[knownClients++]
            : clients[Math.floor(rand() * knownClients)];
        const isFuture = dateStr === todayStr && time >= nowTime;
        const appt = {
          id: `mock-appt-${n}`,
          patientId: client.patientId,
          patientName: client.name,
          patientIdNumber: client.patientIdNumber,
          doctorId: doc.id,
          doctorName: doc.name,
          date: dateStr,
          time,
          type: "in-person",
          status: "booked",
          confirmedVia: "",
          delayMinutes: 0,
        };

        const roll = rand();
        if (!isFuture && roll < 0.09) {
          appt.status = "cancelled";
          appt.cancelledBy = rand() < 0.7 ? client.patientId : "mock-secretary";
        } else {
          const confirmed = isFuture ? rand() < 0.6 : rand() < 0.87;
          if (confirmed) {
            appt.status = "confirmed";
            appt.confirmedVia = pickWeighted(rand, { whatsapp: 0.5, call: 0.3, email: 0.2 });
            appt.confirmedAt = new Date(day);
          }
          const delayChance = (doc.rates[monthIndex] ?? 0.2) * (doc.dow[dow] ?? 1);
          if (!isFuture && rand() < delayChance) {
            const reason = pickWeighted(rand, doc.reasons);
            // On a doctor's bad weekdays the delays are longer as well as more frequent.
            const bad = (doc.dow[dow] ?? 1) > 1;
            const minutes = Number(
              pickWeighted(
                rand,
                bad
                  ? { 10: 0.1, 20: 0.25, 30: 0.35, 45: 0.3 }
                  : { 10: 0.3, 20: 0.35, 30: 0.25, 45: 0.1 },
              ),
            );
            const first = rand() < 0.25 ? Math.max(10, minutes - 10) : minutes;
            appt.statusBeforeDelay = appt.status;
            appt.status = "delayed";
            appt.delayMinutes = minutes;
            appt.delayReason = reason;
            appt.delayNote = NOTES[reason][Math.floor(rand() * NOTES[reason].length)];
            appt.delayHistory =
              first === minutes
                ? [{ minutes, reason }]
                : [{ minutes: first, reason }, { minutes, reason }];
          }
          if (!isFuture && rand() < 0.06) {
            appt.patientLateMinutes = 10 + Math.floor(rand() * 3) * 10;
          }
          // Past appointments: about a third leave a review, lower if delayed.
          if (!isFuture && appt.patientId && rand() < 0.33) {
            const base = doc.rating + (rand() - 0.5) * 1.6 - (appt.delayMinutes ? 0.9 : 0);
            reviews.push({
              id: `mock-review-${n}`,
              appointmentId: appt.id,
              doctorId: doc.id,
              patientId: appt.patientId,
              rating: Math.min(5, Math.max(1, Math.round(base))),
              hidden: false,
            });
          }
        }
        appointments.push(appt);
      }
    }
  }

  return { appointments, doctors: DOCTORS.map(({ id, name, specialty }) => ({ id, name, specialty })), reviews };
}
