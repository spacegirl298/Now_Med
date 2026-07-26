// Firestore data-access layer. All appointment, notification, patient and
// availability reads/writes go through here so the rest of the app never
// touches Firestore SDK calls directly.
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./config";

// ---------- Collections ----------
const usersCol = collection(db, "users");
const appointmentsCol = collection(db, "appointments");
const notificationsCol = collection(db, "notifications");
const blockedSlotsCol = collection(db, "blockedSlots");
const recordsCol = collection(db, "records");

// ================= USERS / PATIENTS =================

// One-time fetch of every registered patient (used by the secretary patient list)
export async function getAllPatients() {
  const q = query(usersCol, where("role", "==", "patient"));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

// Live subscription version, for a dashboard that should reflect new signups instantly
export function subscribeToPatients(callback) {
  const q = query(usersCol, where("role", "==", "patient"));
  return onSnapshot(q, (snap) => {
    const patients = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    callback(patients);
  });
}

export async function getUserById(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Looks up a registered patient by their SA ID / passport number. Used when
// a secretary books a walk-in / phone-in patient, so that if that person
// already has an account the appointment gets attached to their real uid
// instead of being left "unregistered".
export async function getUserByIdNumber(idNumber) {
  if (!idNumber) return null;
  const q = query(usersCol, where("idNumber", "==", idNumber));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

// Patient medical records live in a top-level "records" collection (rather
// than a users/{uid}/records subcollection) so a secretary can attach a
// record to a walk-in patient's ID number before that patient has an
// account, and so it can later be linked to their uid once they sign up.
// Sorted client-side to avoid depending on a composite index.
export async function getPatientRecords(patientUid) {
  const q = query(recordsCol, where("patientId", "==", patientUid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Records for a patient who doesn't have an account yet, looked up by their
// ID/passport number instead of a uid.
export async function getRecordsByIdNumber(idNumber) {
  if (!idNumber) return [];
  const q = query(recordsCol, where("patientIdNumber", "==", idNumber));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Lets a secretary add a medical record for a patient. If the patient has
// no account yet, pass patientId: null and patientIdNumber instead — the
// record will be linked automatically once they register (see
// linkPatientDataByIdNumber).
export async function addPatientRecord({
  patientId = null,
  patientIdNumber = "",
  title,
  date,
  notes = "",
  createdBy = null,
}) {
  const ref = await addDoc(recordsCol, {
    patientId,
    patientIdNumber: patientIdNumber || "",
    title,
    date,
    notes,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ================= APPOINTMENTS =================

// Live subscription to ALL appointments — used by the secretary schedule &
// dashboard. Sorted client-side (rather than via Firestore orderBy on two
// fields) so this doesn't depend on a composite index being deployed.
export function subscribeToAllAppointments(callback, onError) {
  return onSnapshot(
    appointmentsCol,
    (snap) => {
      const appts = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      callback(appts);
    },
    onError,
  );
}

// Live subscription to just enough info to know which slots are taken —
// date, time and status only. Used by the patient-facing calendar to render
// availability without exposing other patients' names, notes, or ids.
export function subscribeToBookedSlots(callback) {
  return onSnapshot(appointmentsCol, (snap) => {
    const slots = snap.docs.map((d) => {
      const data = d.data();
      return { date: data.date, time: data.time, status: data.status };
    });
    callback(slots);
  });
}

// Live subscription scoped to one patient — used by the patient dashboard.
export function subscribeToPatientAppointments(patientId, callback, onError) {
  const q = query(appointmentsCol, where("patientId", "==", patientId));
  return onSnapshot(
    q,
    (snap) => {
      const appts = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      callback(appts);
    },
    onError,
  );
}

// patientId may be null here — that's the case when a secretary books an
// appointment for someone contacted by phone/email/in person who doesn't
// have an account yet. In that case patientIdNumber must be set, and the
// appointment gets attached to the real account automatically once that
// person registers with a matching ID/passport number (see
// linkPatientDataByIdNumber).
export async function createAppointment(data) {
  const patientId = data.patientId || null;

  const ref = await addDoc(appointmentsCol, {
    patientId,
    patientName: data.patientName,
    patientIdNumber: data.patientIdNumber || "",
    patientPhone: data.patientPhone || "",
    contactMethod: data.contactMethod || "",
    secretaryId: data.secretaryId || null,
    date: data.date,
    time: data.time,
    type: data.type || "in-person",
    practice: data.practice || "",
    // Defaults to "booked" (on the calendar, not yet confirmed with the
    // patient) rather than "confirmed". Callers that know the booking is
    // already confirmed — e.g. a patient booking their own slot — should
    // pass status: "confirmed" explicitly.
    status: data.status || "booked",
    confirmedVia: data.confirmedVia || "",
    notes: data.notes || "",
    delayMinutes: 0,
    delayNote: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Only registered patients (with a uid) can receive an in-app notification.
  if (patientId) {
    await createNotification({
      recipientId: patientId,
      appointmentId: ref.id,
      type: "confirmation",
      message: `Your appointment on ${data.date} at ${data.time} has been confirmed.`,
    });
  }

  return ref.id;
}

// Patients booked by a secretary before they've signed up ("walk-ins"),
// grouped by ID number so they show up once in the patient directory even
// if they have several appointments. Used to label/list them by ID number
// until they register and their bookings link to a real account.
export async function getUnlinkedWalkInPatients() {
  const q = query(appointmentsCol, where("patientId", "==", null));
  const snap = await getDocs(q);
  const byIdNumber = new Map();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (!data.patientIdNumber) return;
    if (!byIdNumber.has(data.patientIdNumber)) {
      byIdNumber.set(data.patientIdNumber, {
        id: null,
        idNumber: data.patientIdNumber,
        name: data.patientName || "",
        phone: data.patientPhone || "",
        isWalkIn: true,
        appointmentCount: 0,
      });
    }
    byIdNumber.get(data.patientIdNumber).appointmentCount += 1;
  });
  return Array.from(byIdNumber.values()).sort((a, b) =>
    (a.name || "").localeCompare(b.name || ""),
  );
}

// Called right after a patient registers. Any appointments or records that
// were created for them by a secretary using their ID number (before they
// had an account) get attached to their new uid so they instantly see their
// history.
export async function linkPatientDataByIdNumber(uid, idNumber, name) {
  if (!idNumber) return;

  const apptQ = query(
    appointmentsCol,
    where("patientIdNumber", "==", idNumber),
    where("patientId", "==", null),
  );
  const recordsQ = query(
    recordsCol,
    where("patientIdNumber", "==", idNumber),
    where("patientId", "==", null),
  );

  const [apptSnap, recordsSnap] = await Promise.all([
    getDocs(apptQ),
    getDocs(recordsQ),
  ]);

  if (apptSnap.empty && recordsSnap.empty) return;

  const batch = writeBatch(db);
  apptSnap.docs.forEach((d) => {
    batch.update(d.ref, {
      patientId: uid,
      patientName: name || d.data().patientName,
    });
  });
  recordsSnap.docs.forEach((d) => {
    batch.update(d.ref, { patientId: uid });
  });
  await batch.commit();
}

export async function updateAppointment(appointmentId, data) {
  await updateDoc(doc(db, "appointments", appointmentId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAppointment(appointmentId) {
  await deleteDoc(doc(db, "appointments", appointmentId));
}

export async function cancelAppointment(appointment) {
  await updateAppointment(appointment.id, { status: "cancelled" });
  if (appointment.patientId) {
    await createNotification({
      recipientId: appointment.patientId,
      appointmentId: appointment.id,
      type: "cancellation",
      message: `Your appointment on ${appointment.date} at ${appointment.time} has been cancelled.`,
    });
  }
}

// Secretary marks a delay: updates the appointment and pushes a notification
// to the affected patient in the same write batch of work.
export async function markAppointmentDelay(
  appointment,
  delayMinutes,
  note,
  newTime,
) {
  await updateAppointment(appointment.id, {
    status: "delayed",
    delayMinutes,
    delayNote: note || "",
    delayedTime: newTime,
  });

  if (appointment.patientId) {
    await createNotification({
      recipientId: appointment.patientId,
      appointmentId: appointment.id,
      type: "delay",
      message:
        `Your ${appointment.time} appointment is running ${delayMinutes} min late` +
        (newTime ? ` — now expected at ${newTime}.` : ".") +
        (note ? ` Note: ${note}` : ""),
    });
  }
}

// Secretary confirms an appointment with the patient, recording how the
// confirmation happened (whatsapp / call / email) and notifying the patient
// in-app if they have an account.
export async function confirmAppointment(appointment, method) {
  await updateAppointment(appointment.id, {
    status: "confirmed",
    confirmedVia: method,
    confirmedAt: serverTimestamp(),
  });

  if (appointment.patientId) {
    const methodLabel =
      { whatsapp: "WhatsApp", call: "a phone call", email: "email" }[method] ||
      method;
    await createNotification({
      recipientId: appointment.patientId,
      appointmentId: appointment.id,
      type: "confirmation",
      message: `Your appointment on ${appointment.date} at ${appointment.time} has been confirmed via ${methodLabel}.`,
    });
  }
}

// Reverts a confirmed appointment back to "booked" — e.g. if a confirmation
// was logged in error.
export async function unconfirmAppointment(appointmentId) {
  await updateAppointment(appointmentId, {
    status: "booked",
    confirmedVia: "",
  });
}

// Nudges a patient to confirm an appointment that's still just "booked".
// Stamps reminderSentAt on the appointment so the secretary UI can show
// that a reminder has already gone out.
export async function sendConfirmationReminder(appointment) {
  await updateAppointment(appointment.id, {
    reminderSentAt: serverTimestamp(),
  });

  if (appointment.patientId) {
    await createNotification({
      recipientId: appointment.patientId,
      appointmentId: appointment.id,
      type: "reminder",
      message: `Please confirm your appointment on ${appointment.date} at ${appointment.time}. Reply via WhatsApp, call, or email to let us know you'll be attending.`,
    });
  }
}

// ================= NOTIFICATIONS =================

export async function createNotification({
  recipientId,
  appointmentId = null,
  type,
  message,
}) {
  await addDoc(notificationsCol, {
    recipientId,
    appointmentId,
    type,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToNotifications(recipientId, callback) {
  const q = query(notificationsCol, where("recipientId", "==", recipientId));
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
      );
    callback(items);
  });
}

export async function markNotificationRead(notificationId) {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

// ================= AVAILABILITY / BLOCKED SLOTS =================
// A blocked slot with time === null blocks the whole day.

export function subscribeToBlockedSlots(callback) {
  return onSnapshot(blockedSlotsCol, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Blocks an entire day. `title` is shown to patients on the calendar (e.g.
// "Public holiday", "Doctor on leave") — `reason` is kept as a duplicate
// field for backwards compatibility with any older code/reads.
export async function blockDate(dateStr, title = "") {
  await addDoc(blockedSlotsCol, {
    date: dateStr,
    time: null,
    title,
    reason: title,
    groupId: null,
    createdAt: serverTimestamp(),
  });
}

export async function blockTimeSlot(dateStr, timeStr, title = "") {
  await addDoc(blockedSlotsCol, {
    date: dateStr,
    time: timeStr,
    title,
    reason: title,
    groupId: null,
    createdAt: serverTimestamp(),
  });
}

// Blocks a set of time slots (e.g. every 30-min slot between 12:00-13:00
// for a lunch break) as one titled group, so they can be shown and removed
// together instead of one-by-one. Pass the slot list already computed by
// the caller (see generateTimeSlots in utils/dateHelpers).
export async function blockTimeSlots(dateStr, times, title = "") {
  if (!times || times.length === 0) return null;
  const groupId = `${dateStr}-${Date.now()}`;
  const batch = writeBatch(db);
  times.forEach((timeStr) => {
    const ref = doc(blockedSlotsCol);
    batch.set(ref, {
      date: dateStr,
      time: timeStr,
      title,
      reason: title,
      groupId,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  return groupId;
}

export async function unblockSlot(blockedSlotId) {
  await deleteDoc(doc(db, "blockedSlots", blockedSlotId));
}

// Removes every slot that was created together as an hour-range block.
export async function unblockGroup(groupId) {
  if (!groupId) return;
  const q = query(blockedSlotsCol, where("groupId", "==", groupId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

// ================= PRACTICE / DOCTOR PROFILE =================
// Single shared document describing the practice's doctor, editable by any secretary.

const DOCTOR_PROFILE_ID = "doctorProfile";

export async function getDoctorProfile() {
  const snap = await getDoc(doc(db, "practice", DOCTOR_PROFILE_ID));
  return snap.exists() ? snap.data() : null;
}

export async function saveDoctorProfile(data) {
  await setDoc(
    doc(db, "practice", DOCTOR_PROFILE_ID),
    {
      ...data,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}