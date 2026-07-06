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
  orderBy,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./config";

// ---------- Collections ----------
const usersCol = collection(db, "users");
const appointmentsCol = collection(db, "appointments");
const notificationsCol = collection(db, "notifications");
const blockedSlotsCol = collection(db, "blockedSlots");

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

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

// Patient medical records live in a subcollection: users/{uid}/records
export async function getPatientRecords(patientUid) {
  const recordsCol = collection(db, "users", patientUid, "records");
  const snap = await getDocs(query(recordsCol, orderBy("date", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
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

export async function createAppointment(data) {
  const ref = await addDoc(appointmentsCol, {
    patientId: data.patientId,
    patientName: data.patientName,
    secretaryId: data.secretaryId || null,
    date: data.date,
    time: data.time,
    type: data.type || "in-person",
    status: data.status || "confirmed",
    notes: data.notes || "",
    delayMinutes: 0,
    delayNote: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await createNotification({
    recipientId: data.patientId,
    appointmentId: ref.id,
    type: "confirmation",
    message: `Your appointment on ${data.date} at ${data.time} has been confirmed.`,
  });

  return ref.id;
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
  await createNotification({
    recipientId: appointment.patientId,
    appointmentId: appointment.id,
    type: "cancellation",
    message: `Your appointment on ${appointment.date} at ${appointment.time} has been cancelled.`,
  });
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

export async function blockDate(dateStr, reason = "") {
  await addDoc(blockedSlotsCol, {
    date: dateStr,
    time: null,
    reason,
    createdAt: serverTimestamp(),
  });
}

export async function blockTimeSlot(dateStr, timeStr, reason = "") {
  await addDoc(blockedSlotsCol, {
    date: dateStr,
    time: timeStr,
    reason,
    createdAt: serverTimestamp(),
  });
}

export async function unblockSlot(blockedSlotId) {
  await deleteDoc(doc(db, "blockedSlots", blockedSlotId));
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
