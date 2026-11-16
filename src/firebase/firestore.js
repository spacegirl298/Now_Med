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
  writeBatch,
  runTransaction,
  Timestamp,
  orderBy,
  limit,
  increment,
  setDoc,
  arrayUnion,
} from "firebase/firestore";
import { db, auth } from "./config";
import { generateMeetingLink } from "../utils/meeting";

// ---------- Collections ----------
const usersCol = collection(db, "users");
const appointmentsCol = collection(db, "appointments");
const appointmentSlotsCol = collection(db, "appointmentSlots");
function appointmentSlotId(date, time, doctorId = null) {
  return doctorId ? `${date}_${time}_${doctorId}` : `${date}_${time}`;
}
const notificationsCol = collection(db, "notifications");
const blockedSlotsCol = collection(db, "blockedSlots");
const recordsCol = collection(db, "records");
const profilesCol = collection(db, "patientProfiles");
const intakeFormsCol = collection(db, "intakeForms");
const changeRequestsCol = collection(db, "changeRequests");
const conversationsCol = collection(db, "conversations");
const analyticsSummaryCol = collection(db, "analyticsSummary");

// ================= USERS / PATIENTS =================

export async function getAllPatients() {
  const q = query(usersCol, where("role", "==", "patient"));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

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

export async function getUserByIdNumber(idNumber) {
  if (!idNumber) return null;
  const q = query(usersCol, where("idNumber", "==", idNumber));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function reserveIdNumberIndexSlot(idNumber, uid, role) {
  const ref = doc(db, "idNumberIndex", idNumber);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);

    if (!snap.exists()) {
      transaction.set(ref, {
        patientUid: role === "patient" ? uid : null,
        secretaryUid: role === "secretary" ? uid : null,
      });
      return;
    }

    const existing = snap.data();

    if (role === "patient") {
      if (existing.patientUid) {
        const err = new Error(
          "An account with this ID/passport number already exists. Please log in instead, or contact the practice if you believe this is a mistake.",
        );
        err.code = "duplicate-id-number";
        throw err;
      }
      transaction.update(ref, { patientUid: uid });
      return;
    }

    const err = new Error(
      "An account with this ID/passport number already exists. Please log in instead, or contact the practice if you believe this is a mistake.",
    );
    err.code = "duplicate-id-number";
    throw err;
  });
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

export async function getPatientRecords(patientUid) {
  const q = query(recordsCol, where("patientId", "==", patientUid));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export async function getRecordsByIdNumber(idNumber) {
  if (!idNumber) return [];
  const q = query(recordsCol, where("patientIdNumber", "==", idNumber));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export function subscribeToPatientRecords(patientUid, callback, onError) {
  if (!patientUid) return () => {};
  const q = query(recordsCol, where("patientId", "==", patientUid));
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      callback(records);
    },
    onError,
  );
}

export async function addPatientRecord({
  patientId = null,
  patientIdNumber = "",
  type = "note",
  title,
  date,
  notes = "",
  doctor = "",
  reasonForVisit = "",
  diagnosis = "",
  treatment = "",
  followUpRequired = false,
  vitals = null,
  createdBy = null,
  internalOnly = false,
}) {
  const ref = await addDoc(recordsCol, {
    patientId,
    patientIdNumber: patientIdNumber || "",
    type,
    title,
    date,
    notes,
    doctor,
    reasonForVisit,
    diagnosis,
    treatment,
    followUpRequired,
    vitals,
    createdBy,
    internalOnly,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}


export async function getPatientProfile(patientId) {
  if (!patientId) return null;
  const q = query(profilesCol, where("patientId", "==", patientId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export function subscribeToPatientProfile(patientId, callback, onError) {
  if (!patientId) return () => {};
  const q = query(profilesCol, where("patientId", "==", patientId));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) return callback(null);
      const d = snap.docs[0];
      callback({ id: d.id, ...d.data() });
    },
    onError,
  );
}

export async function getPatientProfileByIdNumber(idNumber) {
  if (!idNumber) return null;
  const q = query(profilesCol, where("patientIdNumber", "==", idNumber));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function savePatientProfile({
  profileId = null,
  patientId = null,
  patientIdNumber = "",
  ...fields
}) {
  if (profileId) {
    await updateDoc(doc(db, "patientProfiles", profileId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
    return profileId;
  }
  const ref = await addDoc(profilesCol, {
    patientId,
    patientIdNumber: patientIdNumber || "",
    ...fields,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ================= APPOINTMENTS =================

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

export function subscribeToBookedSlots(callback) {
  return onSnapshot(appointmentSlotsCol, (snap) => {
    const slots = snap.docs.map((d) => {
      const data = d.data();
      return {
        date: data.date,
        time: data.time,
        status: data.status,
        doctorId: data.doctorId || null,
      };
    });
    callback(slots);
  });
}

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
  const patientId = data.patientId || null;

  const appointmentRef = doc(appointmentsCol);

  const newAppointment = {
    patientId,
    patientName: data.patientName,
    patientIdNumber: data.patientIdNumber || "",
    patientPhone: data.patientPhone || "",
    contactMethod: data.contactMethod || "",
    secretaryId: data.secretaryId || null,
    doctorId: data.doctorId || null,
    doctorName: data.doctorName || "",
    date: data.date,
    time: data.time,
    appointmentAt:
      data.appointmentAt ||
      Timestamp.fromDate(new Date(`${data.date}T${data.time}:00`)),
    type: data.type || "in-person",
    meetingLink:
      (data.type || "in-person") === "virtual"
        ? data.meetingLink || generateMeetingLink()
        : "",
    practice: data.practice || "",
    status: data.status || "booked",
    confirmedVia: data.confirmedVia || "",
    notes: data.notes || "",
    delayMinutes: 0,
    delayNote: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const slotId = appointmentSlotId(data.date, data.time, data.doctorId || null);
  const slotRef = doc(appointmentSlotsCol, slotId);
  await runTransaction(db, async (transaction) => {
    const slotSnap = await transaction.get(slotRef);
    const hasActiveConflict =
      slotSnap.exists() && slotSnap.data().status !== "cancelled";

    if (hasActiveConflict) {
      const error = new Error(
        "Sorry, that slot was just booked by someone else. Please pick another time.",
      );
      error.code = "slot-taken";
      throw error;
    }

    transaction.set(appointmentRef, newAppointment);
    transaction.set(slotRef, {
      date: newAppointment.date,
      time: newAppointment.time,
      status: newAppointment.status,
      doctorId: newAppointment.doctorId || null,
      appointmentId: appointmentRef.id,
      patientId,
    });
  });

  if (patientId) {
    await createNotification({
      recipientId: patientId,
      appointmentId: appointmentRef.id,
      type: "confirmation",
      message:
        newAppointment.type === "virtual"
          ? `Your virtual appointment on ${data.date} at ${data.time} is booked. Join online: ${newAppointment.meetingLink}`
          : `Your appointment on ${data.date} at ${data.time} has been confirmed.`,
    });
    notifyIfIntakeIncomplete(patientId, data.patientName, data.date, data.time);
  }

  if (newAppointment.doctorId) {
    await syncDoctorAnalyticsFromAppointment({
      doctorId: newAppointment.doctorId,
      doctorName: newAppointment.doctorName || "Doctor",
      appointmentDate: newAppointment.date,
    });
  }

  return appointmentRef.id;
}

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
  const profileQ = query(
    profilesCol,
    where("patientIdNumber", "==", idNumber),
    where("patientId", "==", null),
  );

  const intakeQ = query(
    intakeFormsCol,
    where("patientIdNumber", "==", idNumber),
    where("patientId", "==", null),
  );

  const [apptSnap, recordsSnap, profileSnap, intakeSnap] = await Promise.all([
    getDocs(apptQ),
    getDocs(recordsQ),
    getDocs(profileQ),
    getDocs(intakeQ),
  ]);

  if (
    apptSnap.empty &&
    recordsSnap.empty &&
    profileSnap.empty &&
    intakeSnap.empty
  )
    return;

  const batch = writeBatch(db);
  apptSnap.docs.forEach((d) => {
    const data = d.data();
    batch.update(d.ref, {
      patientId: uid,
      patientName: name || data.patientName,
    });
    batch.set(
      doc(appointmentSlotsCol, appointmentSlotId(data.date, data.time)),
      { patientId: uid },
      { merge: true },
    );
  });
  recordsSnap.docs.forEach((d) => {
    batch.update(d.ref, { patientId: uid });
  });
  profileSnap.docs.forEach((d) => {
    batch.update(d.ref, { patientId: uid });
  });
  intakeSnap.docs.forEach((d) => {
    batch.update(d.ref, { patientId: uid });
  });
  await batch.commit();
}

export async function updateAppointment(appointmentId, data) {
  const apptRef = doc(db, "appointments", appointmentId);
  const batch = writeBatch(db);
  batch.update(apptRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });

  if (
    data.status !== undefined ||
    data.date !== undefined ||
    data.time !== undefined
  ) {
    const existingSnap = await getDoc(apptRef);
    if (existingSnap.exists()) {
      const existing = existingSnap.data();
      const oldSlotId = appointmentSlotId(
        existing.date,
        existing.time,
        existing.doctorId || null,
      );
      const newDate = data.date ?? existing.date;
      const newTime = data.time ?? existing.time;
      const newStatus = data.status ?? existing.status;
      const newDoctorId = data.doctorId ?? existing.doctorId ?? null;
      const newSlotId = appointmentSlotId(newDate, newTime, newDoctorId);

      if (newSlotId !== oldSlotId) {
        batch.delete(doc(appointmentSlotsCol, oldSlotId));
        batch.set(doc(appointmentSlotsCol, newSlotId), {
          date: newDate,
          time: newTime,
          status: newStatus,
          doctorId: newDoctorId,
          appointmentId,
          patientId: existing.patientId ?? null,
        });
      } else {
        batch.set(
          doc(appointmentSlotsCol, oldSlotId),
          { status: newStatus, doctorId: newDoctorId },
          { merge: true },
        );
      }
    }
  }

  await batch.commit();
}

export async function deleteAppointment(appointmentId) {
  const apptRef = doc(db, "appointments", appointmentId);
  const existingSnap = await getDoc(apptRef);
  const batch = writeBatch(db);
  batch.delete(apptRef);
  if (existingSnap.exists()) {
    const existing = existingSnap.data();
    batch.delete(
      doc(
        appointmentSlotsCol,
        appointmentSlotId(
          existing.date,
          existing.time,
          existing.doctorId || null,
        ),
      ),
    );
  }
  await batch.commit();
}

export async function cancelAppointment(appointment, userId, options = {}) {
  if (!appointment?.id) throw new Error("Missing appointment id.");

  const { isStaff = false } = options;

  if (!isStaff) {
    const appointmentDate = appointment.appointmentAt?.toDate
      ? appointment.appointmentAt.toDate()
      : new Date(`${appointment.date}T${appointment.time}:00`);
    const hoursUntilAppointment =
      (appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60);

    if (!Number.isFinite(hoursUntilAppointment)) {
      throw new Error("This appointment does not have a valid date and time.");
    }

    if (hoursUntilAppointment <= 3) {
      const error = new Error(
        hoursUntilAppointment <= 2
          ? "This appointment is within 2 hours and cannot be cancelled online. Please contact the practice to cancel or reschedule."
          : "This appointment is less than 3 hours away and cannot be cancelled online. Please contact the practice to cancel or reschedule.",
      );
      error.code = "late-cancellation";
      throw error;
    }
  }

  await updateAppointment(appointment.id, {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    cancelledBy: userId || appointment.patientId || null,
  });

  if (appointment.patientId) {
    await createNotification({
      recipientId: appointment.patientId,
      appointmentId: appointment.id,
      type: "cancellation",
      message: `Your appointment on ${appointment.date} at ${appointment.time} has been cancelled.`,
    });
  }
}

export async function markPatientLate(appointment, minutesLate, note) {
  await updateAppointment(appointment.id, {
    patientLateMinutes: minutesLate,
    patientLateNote: note || "",
  });

  if (appointment.doctorId && appointment.date) {
    await syncDoctorAnalyticsFromLateArrival({
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName || "Doctor",
      appointmentDate: appointment.date,
      minuteDelta: minutesLate,
      note: note || "",
      source: "patient",
    });
  }
}

export async function reportPatientRunningLate(appointmentId, minutesLate) {
  await updateDoc(doc(db, "appointments", appointmentId), {
    patientRunningLate: true,
    patientRunningLateMinutes: minutesLate ?? null,
    patientRunningLateAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function acknowledgePatientRunningLate(appointmentId) {
  await updateAppointment(appointmentId, {
    patientRunningLate: false,
  });
}

export async function markAppointmentDelay(
  appointment,
  delayMinutes,
  note,
  newTime,
  reason = "",
) {
  const entry = {
    minutes: delayMinutes,
    reason: reason || "",
    note: note || "",
    markedAt: Timestamp.now(),
    markedBy: auth.currentUser?.uid || null,
  };

  await updateAppointment(appointment.id, {
    status: "delayed",
    ...(appointment.status !== "delayed" && {
      statusBeforeDelay: appointment.status || "booked",
    }),
    delayMinutes,
    delayNote: note || "",
    delayReason: reason || "",
    delayedTime: newTime,
    delayedAt: serverTimestamp(),
    delayHistory: arrayUnion(entry),
  });

  if (appointment.doctorId && appointment.date) {
    await syncDoctorAnalyticsFromLateArrival({
      doctorId: appointment.doctorId,
      doctorName: appointment.doctorName || "Doctor",
      appointmentDate: appointment.date,
      minuteDelta: delayMinutes,
      note: note || "",
      source: "secretary",
    });
  }

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
      message:
        `Your appointment on ${appointment.date} at ${appointment.time} has been confirmed via ${methodLabel}.` +
        (appointment.type === "virtual" && appointment.meetingLink
          ? ` Join online: ${appointment.meetingLink}`
          : ""),
    });
  }
}

export async function unconfirmAppointment(appointmentId) {
  await updateAppointment(appointmentId, {
    status: "booked",
    confirmedVia: "",
  });
}

export async function sendConfirmationReminder(appointment) {
  await updateAppointment(appointment.id, {
    reminderSentAt: serverTimestamp(),
  });

  if (appointment.patientId) {
    const message =
      `Please confirm your appointment on ${appointment.date} at ${appointment.time}. Reply via WhatsApp, call, or email to let us know you'll be attending.` +
      (appointment.type === "virtual" && appointment.meetingLink
        ? ` This is an online consult - join here: ${appointment.meetingLink}`
        : "");
    await createNotification({
      recipientId: appointment.patientId,
      appointmentId: appointment.id,
      type: "reminder",
      message,
    });

    try {
      await sendMessage({
        patientId: appointment.patientId,
        patientName: appointment.patientName,
        senderRole: "secretary",
        senderName: "Practice",
        text: message,
        kind: "reminder",
        appointmentId: appointment.id,
      });
    } catch (err) {
      console.error("Reminder sent, but could not post it to chat:", err);
    }
  }
}

// ================= NOTIFICATIONS =================

async function notifyAllSecretaries({
  type,
  message,
  appointmentId = null,
  patientId = null,
  changeRequestId = null,
}) {
  const snap = await getDocs(collection(db, "secretaryDirectory"));
  await Promise.all(
    snap.docs.map((d) =>
      createNotification({
        recipientId: d.id,
        appointmentId,
        patientId,
        changeRequestId,
        type,
        message,
      }),
    ),
  );
}

export async function createNotification({
  recipientId,
  appointmentId = null,
  patientId = null,
  changeRequestId = null,
  type,
  message,
}) {
  await addDoc(notificationsCol, {
    recipientId,
    appointmentId,
    patientId,
    changeRequestId,
    type,
    message,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export async function deleteNotification(notificationId) {
  await deleteDoc(doc(db, "notifications", notificationId));
}

async function deleteChangeRequestNotifications(changeRequestId) {
  if (!changeRequestId) return;
  const q = query(
    notificationsCol,
    where("changeRequestId", "==", changeRequestId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
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

export async function markNotificationsRead(notificationIds) {
  for (let i = 0; i < notificationIds.length; i += 400) {
    const batch = writeBatch(db);
    notificationIds.slice(i, i + 400).forEach((id) => {
      batch.update(doc(db, "notifications", id), { read: true });
    });
    await batch.commit();
  }
}

export async function markChatNotificationsRead(recipientId) {
  if (!recipientId) return;
  const q = query(
    notificationsCol,
    where("recipientId", "==", recipientId),
    where("type", "in", ["message", "reminder", "intake_reminder"]),
    where("read", "==", false),
  );
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function markMessageNotificationsRead(recipientId, patientId) {
  if (!recipientId || !patientId) return;
  const q = query(
    notificationsCol,
    where("recipientId", "==", recipientId),
    where("type", "==", "message"),
    where("read", "==", false),
  );
  const snap = await getDocs(q);
  const matchingDocs = snap.docs.filter(
    (d) => d.data().patientId === patientId,
  );
  if (matchingDocs.length === 0) return;
  const batch = writeBatch(db);
  matchingDocs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}


export function subscribeToBlockedSlots(callback) {
  return onSnapshot(blockedSlotsCol, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function blockDate(
  dateStr,
  title = "",
  doctorId = null,
  doctorName = "",
) {
  await addDoc(blockedSlotsCol, {
    date: dateStr,
    time: null,
    title,
    reason: title,
    doctorId: doctorId || null,
    doctorName: doctorName || "",
    groupId: null,
    createdAt: serverTimestamp(),
  });
}

export async function blockTimeSlot(
  dateStr,
  timeStr,
  title = "",
  doctorId = null,
  doctorName = "",
) {
  await addDoc(blockedSlotsCol, {
    date: dateStr,
    time: timeStr,
    title,
    reason: title,
    doctorId: doctorId || null,
    doctorName: doctorName || "",
    groupId: null,
    createdAt: serverTimestamp(),
  });
}

export async function blockTimeSlots(
  dateStr,
  times,
  title = "",
  doctorId = null,
  doctorName = "",
) {
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
      doctorId: doctorId || null,
      doctorName: doctorName || "",
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

export async function unblockGroup(groupId) {
  if (!groupId) return;
  const q = query(blockedSlotsCol, where("groupId", "==", groupId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}


const doctorsCol = collection(db, "doctors");
const doctorRatingsCol = collection(db, "doctorRatings");

export function subscribeToDoctors(callback, onError) {
  return onSnapshot(
    doctorsCol,
    (snap) => {
      const doctors = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      callback(doctors);
    },
    onError,
  );
}

export async function getDoctors() {
  const snap = await getDocs(doctorsCol);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

export async function getDoctorById(doctorId) {
  if (!doctorId) return null;
  const snap = await getDoc(doc(db, "doctors", doctorId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function addDoctor(data) {
  const ref = await addDoc(doctorsCol, {
    name: data.name || "",
    specialty: data.specialty || "",
    certifications: data.certifications || "",
    bio: data.bio || "",
    contact: data.contact || "",
    profileCharacter: data.profileCharacter || "",
    address: data.address || "",
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDoctor(doctorId, data) {
  await updateDoc(doc(db, "doctors", doctorId), {
    name: data.name || "",
    specialty: data.specialty || "",
    certifications: data.certifications || "",
    bio: data.bio || "",
    contact: data.contact || "",
    profileCharacter: data.profileCharacter || "",
    address: data.address || "",
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDoctor(doctorId) {
  const blockedQ = query(blockedSlotsCol, where("doctorId", "==", doctorId));
  const blockedSnap = await getDocs(blockedQ);
  const batch = writeBatch(db);

  blockedSnap.docs.forEach((docSnap) => {
    batch.delete(docSnap.ref);
  });

  batch.delete(doc(db, "doctors", doctorId));
  await batch.commit();
}


export async function syncDoctorAnalyticsFromAppointment() {}

export async function syncDoctorAnalyticsFromLateArrival() {}

export async function createDoctorRating({
  appointmentId,
  doctorId,
  patientId,
  rating,
  comment = "",
}) {
  await setDoc(doc(doctorRatingsCol, appointmentId), {
    appointmentId,
    doctorId,
    patientId,
    rating,
    comment,
    hidden: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    if (!doctorId) return;
    await syncDoctorAnalyticsFromReviews({
      doctorId,
      patientId,
      appointmentId,
      rating,
      comment,
    });
  } catch (err) {
    console.error("Failed to update analytics for doctor review:", err);
  }
}

export async function syncDoctorAnalyticsFromReviews() {}

export async function backfillDoctorAnalyticsFromAppointmentsAndReviews() {
  const [appointmentsSnap, reviewsSnap] = await Promise.all([
    getDocs(appointmentsCol),
    getDocs(doctorRatingsCol),
  ]);

  const doctorNames = new Map();
  const aggregates = new Map();

  const ensureAggregate = (doctorId, periodType, periodKey, doctorName) => {
    const key = `${doctorId}|${periodType}|${periodKey}`;
    if (!aggregates.has(key)) {
      aggregates.set(key, {
        doctorId,
        doctorName,
        periodType,
        periodKey,
        totalAppointments: 0,
        reviewCount: 0,
        totalRating: 0,
      });
    }
    return aggregates.get(key);
  };

  for (const apptDoc of appointmentsSnap.docs) {
    const appt = apptDoc.data();
    const doctorId = appt.doctorId;
    if (!doctorId) continue;

    const doctor = doctorNames.get(doctorId) || (await getDoctorById(doctorId));
    if (!doctorNames.has(doctorId)) {
      doctorNames.set(doctorId, doctor?.name || "Doctor");
    }

    const date =
      appt.date || appt.appointmentAt?.toDate?.().toISOString().slice(0, 10);
    if (!date) continue;

    const monthKey = date.slice(0, 7);
    const weekStart = new Date(`${date}T12:00:00`);
    weekStart.setHours(0, 0, 0, 0);
    const day = weekStart.getDay();
    const diffToMonday = (day + 6) % 7;
    weekStart.setDate(weekStart.getDate() - diffToMonday);
    const weekKey = weekStart.toISOString().slice(0, 10);

    for (const period of [
      { periodType: "month", periodKey: monthKey },
      { periodType: "week", periodKey: weekKey },
    ]) {
      const entry = ensureAggregate(
        doctorId,
        period.periodType,
        period.periodKey,
        doctorNames.get(doctorId) || "Doctor",
      );
      entry.totalAppointments += 1;

      const lateMinutes = appt.patientLateMinutes ?? appt.delayMinutes ?? null;
      const lateNote = appt.patientLateNote || appt.delayNote || "";
      const isLate = lateMinutes != null && Number(lateMinutes) > 0;
      if (isLate) {
        entry.lateArrivalCount = (entry.lateArrivalCount || 0) + 1;
        entry.lateArrivalDetails = [
          ...(entry.lateArrivalDetails || []),
          {
            doctorId,
            doctorName: doctorNames.get(doctorId) || "Doctor",
            source: appt.patientLateMinutes != null ? "patient" : "secretary",
            appointmentDate: date,
            minutesLate: Number(lateMinutes),
            note: lateNote,
          },
        ];
      }
    }
  }

  for (const reviewDoc of reviewsSnap.docs) {
    const review = reviewDoc.data();
    const doctorId = review.doctorId;
    if (!doctorId) continue;

    const doctor = doctorNames.get(doctorId) || (await getDoctorById(doctorId));
    if (!doctorNames.has(doctorId)) {
      doctorNames.set(doctorId, doctor?.name || "Doctor");
    }

    const createdAt = review.createdAt?.toDate
      ? review.createdAt.toDate()
      : new Date();
    const monthKey = createdAt.toISOString().slice(0, 7);
    const weekStart = new Date(createdAt);
    weekStart.setHours(0, 0, 0, 0);
    const day = weekStart.getDay();
    const diffToMonday = (day + 6) % 7;
    weekStart.setDate(weekStart.getDate() - diffToMonday);
    const weekKey = weekStart.toISOString().slice(0, 10);

    for (const period of [
      { periodType: "month", periodKey: monthKey },
      { periodType: "week", periodKey: weekKey },
    ]) {
      const entry = ensureAggregate(
        doctorId,
        period.periodType,
        period.periodKey,
        doctorNames.get(doctorId) || "Doctor",
      );
      entry.reviewCount += 1;
      entry.totalRating += Number(review.rating || 0);
    }
  }

  await Promise.all(
    [...aggregates.values()].map(async (entry) => {
      const avgReviewRating = entry.reviewCount
        ? entry.totalRating / entry.reviewCount
        : 0;

      await upsertAnalyticsSummary({
        entityType: "doctor",
        entityId: entry.doctorId,
        periodType: entry.periodType,
        periodKey: entry.periodKey,
        doctorName: entry.doctorName,
        totalAppointments: entry.totalAppointments || 0,
        reviewCount: entry.reviewCount || 0,
        avgReviewRating,
        lateArrivalCount: entry.lateArrivalCount || 0,
        lateArrivalDetails: entry.lateArrivalDetails || [],
        lastReviewAt: entry.reviewCount ? serverTimestamp() : null,
      });
    }),
  );

  return [...aggregates.values()];
}

export async function updateDoctorRating(appointmentId, { rating, comment }) {
  await updateDoc(doc(doctorRatingsCol, appointmentId), {
    rating,
    comment,
    updatedAt: serverTimestamp(),
  });
}

export async function setDoctorRatingHidden(appointmentId, hidden) {
  await updateDoc(doc(doctorRatingsCol, appointmentId), {
    hidden,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDoctorRating(appointmentId) {
  await deleteDoc(doc(doctorRatingsCol, appointmentId));
}

export async function getDoctorRatingByAppointment(appointmentId) {
  const snap = await getDoc(doc(doctorRatingsCol, appointmentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeToPatientReviews(patientId, callback, onError) {
  if (!patientId) return () => {};
  const q = query(
    doctorRatingsCol,
    where("patientId", "==", patientId),
    where("hidden", "==", false),
  );
  return onSnapshot(
    q,
    (snap) => {
      const reviews = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
        );
      callback(reviews);
    },
    onError,
  );
}

export function subscribeToDoctorRatings(doctorId, callback, onError) {
  const q = query(
    doctorRatingsCol,
    where("doctorId", "==", doctorId),
    where("hidden", "==", false),
  );
  return onSnapshot(
    q,
    (snap) => {
      const reviews = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
        );
      callback(reviews);
    },
    onError,
  );
}

export function subscribeToAllDoctorRatings(callback, onError) {
  return onSnapshot(
    doctorRatingsCol,
    (snap) => {
      const reviews = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
        );
      callback(reviews);
    },
    onError,
  );
}

// ================= ANALYTICS =================
export function subscribeToAnalyticsSummary(filters = {}, callback, onError) {
  const conditions = [];
  if (filters.entityType) {
    conditions.push(where("entityType", "==", filters.entityType));
  }
  if (filters.entityId) {
    conditions.push(where("entityId", "==", filters.entityId));
  }
  if (filters.periodType) {
    conditions.push(where("periodType", "==", filters.periodType));
  }
  if (filters.periodKey) {
    conditions.push(where("periodKey", "==", filters.periodKey));
  }

  const q =
    conditions.length > 0
      ? query(analyticsSummaryCol, ...conditions)
      : analyticsSummaryCol;

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(list);
    },
    onError,
  );
}

export function subscribeToAnalyticsSummaries(filters = {}, callback, onError) {
  return subscribeToAnalyticsSummary(filters, callback, onError);
}

export async function getAnalyticsSummary(filters = {}) {
  const conditions = [];
  if (filters.entityType) {
    conditions.push(where("entityType", "==", filters.entityType));
  }
  if (filters.entityId) {
    conditions.push(where("entityId", "==", filters.entityId));
  }
  if (filters.periodType) {
    conditions.push(where("periodType", "==", filters.periodType));
  }
  if (filters.periodKey) {
    conditions.push(where("periodKey", "==", filters.periodKey));
  }

  const q =
    conditions.length > 0
      ? query(analyticsSummaryCol, ...conditions)
      : analyticsSummaryCol;
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function upsertAnalyticsSummary({
  entityType,
  entityId,
  periodType,
  periodKey,
  ...payload
}) {
  if (!entityType || !periodType || !periodKey) {
    return null;
  }

  const id = `${entityType}_${entityId || "all"}_${periodType}_${periodKey}`;
  const ref = doc(analyticsSummaryCol, id);
  const current = await getDoc(ref);
  const next = {
    entityType,
    entityId: entityId || null,
    periodType,
    periodKey,
    updatedAt: serverTimestamp(),
    ...(current.exists() ? current.data() : {}),
    ...payload,
  };

  await setDoc(ref, next, { merge: true });
  return { id: ref.id, ...next };
}


export async function getIntakeForm(patientId) {
  if (!patientId) return null;
  const q = query(intakeFormsCol, where("patientId", "==", patientId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getIntakeFormByIdNumber(idNumber) {
  if (!idNumber) return null;
  const q = query(
    intakeFormsCol,
    where("patientIdNumber", "==", idNumber),
    where("patientId", "==", null),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

export async function getIntakeFormForPatient(patientId, idNumber) {
  const byUid = await getIntakeForm(patientId);
  if (byUid) return byUid;
  return getIntakeFormByIdNumber(idNumber);
}

export async function saveIntakeForm({
  patientId,
  patientIdNumber = "",
  answers,
  submittedBy = "patient",
  captureMethod = "digital",
  capturedBy = null,
}) {
  const ref = await addDoc(intakeFormsCol, {
    patientId,
    patientIdNumber: patientIdNumber || "",
    answers,
    submittedBy,
    captureMethod,
    capturedBy,
    importedAt: null,
    submittedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function linkIntakeFormToPatient(intakeId, patientId) {
  await updateDoc(doc(db, "intakeForms", intakeId), { patientId });
}

export async function markIntakeImported(intakeId, staffUid) {
  await updateDoc(doc(db, "intakeForms", intakeId), {
    importedAt: serverTimestamp(),
    importedBy: staffUid || null,
  });
}

export async function sendIntakeReminder(patient) {
  if (!patient?.id) {
    throw new Error(
      "This patient doesn't have an account yet to send a reminder to.",
    );
  }
  const childName = patient.isChild
    ? patient.firstName || patient.name || "your child"
    : "";
  await createNotification({
    recipientId: patient.id,
    type: "intake_reminder",
    message: patient.isChild
      ? `Please complete ${childName}'s intake form before their next visit.`
      : "Please complete your first-time patient intake form before your next visit.",
  });
  await sendMessage({
    patientId: patient.id,
    patientName: patient.name || "",
    senderRole: "secretary",
    senderName: "Practice",
    text: patient.isChild
      ? `Hi! Could you please complete ${childName}'s intake form before their next visit? You can find it on ${childName}'s page under Family.`
      : "Hi! Could you please complete your first-time patient intake form before your next visit? You can find it from your dashboard.",
    kind: "reminder",
  });
}

async function notifyIfIntakeIncomplete(patientId, patientName, date, time) {
  try {
    const userDoc = await getDoc(doc(db, "users", patientId));
    const data = userDoc.exists() ? userDoc.data() : null;
    if (data && data.hasCompletedIntake) return;
    if (!userDoc.exists()) {
      const childDoc = await getDoc(doc(db, "children", patientId));
      if (childDoc.exists()) {
        const child = childDoc.data();
        if (child.hasCompletedIntake) return;
        if (await getIntakeForm(patientId)) return;
        await notifyAllSecretaries({
          type: "intake_incomplete",
          message: `${patientName || child.name || "A child"} has an appointment on ${date} at ${time} but doesn't have an intake form yet.`,
        });
        return;
      }
    }
    const form = await getIntakeFormForPatient(patientId, data?.idNumber);
    if (form) return;
    await notifyAllSecretaries({
      type: "intake_incomplete",
      message: `${patientName || "A patient"} has an appointment on ${date} at ${time} but hasn't completed their intake form yet.`,
    });
  } catch (err) {
    console.error("Could not check/notify about intake status:", err);
  }
}


export async function createChangeRequest({
  patientId,
  patientName = "",
  patientIdNumber = "",
  section,
  currentValue = "",
  requestedChange,
}) {
  const ref = await addDoc(changeRequestsCol, {
    patientId,
    patientName,
    patientIdNumber,
    section,
    currentValue,
    requestedChange,
    status: "pending",
    resolutionNote: "",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: serverTimestamp(),
  });

  try {
    await notifyAllSecretaries({
      type: "change_request",
      patientId,
      changeRequestId: ref.id,
      message: `${patientName || "A patient"} requested a change to their ${(section || "details").toLowerCase()}.`,
    });
  } catch (err) {
    console.error(
      "Change request saved, but the secretary notification failed:",
      err,
    );
  }

  return ref.id;
}

const byNewest = (a, b) =>
  (b.createdAt?.seconds || Number.MAX_SAFE_INTEGER) -
  (a.createdAt?.seconds || Number.MAX_SAFE_INTEGER);

export function subscribeToPatientChangeRequests(patientId, callback, onError) {
  if (!patientId) return () => {};
  const q = query(changeRequestsCol, where("patientId", "==", patientId));
  return onSnapshot(
    q,
    (snap) =>
      callback(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest),
      ),
    onError,
  );
}

export function subscribeToPendingChangeRequests(callback, onError) {
  const q = query(changeRequestsCol, where("status", "==", "pending"));
  return onSnapshot(
    q,
    (snap) =>
      callback(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest),
      ),
    onError,
  );
}

export async function resolveChangeRequest({
  request,
  status,
  note = "",
  resolvedBy = null,
}) {
  await updateDoc(doc(db, "changeRequests", request.id), {
    status,
    resolutionNote: note,
    resolvedBy,
    resolvedAt: serverTimestamp(),
  });

  const what = (request.section || "details").toLowerCase();
  await createNotification({
    recipientId: request.patientId,
    type: "change_request",
    message:
      status === "completed"
        ? `Your request to update your ${what} has been completed.`
        : `Your request to update your ${what} could not be actioned.${note ? ` Note: ${note}` : ""}`,
  });

  await deleteChangeRequestNotifications(request.id);
}


export function subscribeToConversation(patientId, callback, onError) {
  if (!patientId) return () => {};
  return onSnapshot(
    doc(db, "conversations", patientId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

export function subscribeToAllConversations(callback, onError) {
  return onSnapshot(
    conversationsCol,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a, b) =>
            (b.lastMessageAt?.seconds || Number.MAX_SAFE_INTEGER) -
            (a.lastMessageAt?.seconds || Number.MAX_SAFE_INTEGER),
        );
      callback(list);
    },
    onError,
  );
}

export function subscribeToMessages(patientId, callback, onError) {
  if (!patientId) return () => {};
  const q = query(
    collection(db, "conversations", patientId, "messages"),
    orderBy("createdAt", "desc"),
    limit(200),
  );
  return onSnapshot(
    q,
    (snap) =>
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse()),
    onError,
  );
}

const EXPLICIT_LANGUAGE_PATTERN =
  /\b(fuck(ing|er|ed)?|shit(ty)?|bitch(es)?|ass(hole)?|bastard|cunt|dick(head)?|piss(ed)?\s*off|whore|slut|hoe|sexy|voetsek)\b/i;

const HARASSMENT_PHRASE_PATTERN =
  /\byou'?re\s+so\s+sexy\b|\bwhat\s+are\s+you\s+wearing\b|\bsend\s+(me\s+)?(a\s+)?(nude|pic(ture)?s?)\b/i;

function containsExplicitLanguage(text) {
  const body = text || "";
  return (
    EXPLICIT_LANGUAGE_PATTERN.test(body) || HARASSMENT_PHRASE_PATTERN.test(body)
  );
}

const CRISIS_LANGUAGE_PATTERN =
  /\b(kill\s+(myself|yourself)|kms|suicide|suicidal|end\s+my\s+life|end\s+it\s+all|self[- ]harm|want(ed)?\s+to\s+die|don'?t\s+want\s+to\s+live)\b/i;

function containsCrisisLanguage(text) {
  return CRISIS_LANGUAGE_PATTERN.test(text || "");
}

export async function sendMessage({
  patientId,
  patientName = "",
  senderRole,
  senderName = "",
  text,
  kind = "message",
  appointmentId = null,
  notify = false,
}) {
  const body = (text || "").trim();
  if (!patientId || !body) {
    throw new Error("A patient and some message text are required.");
  }
  const isCrisis = containsCrisisLanguage(body);
  if (!isCrisis && containsExplicitLanguage(body)) {
    const error = new Error(
      "This message can't be sent because it contains inappropriate language.",
    );
    error.code = "inappropriate-language";
    throw error;
  }
  const fromPatient = senderRole === "patient";

  const conversationRef = doc(db, "conversations", patientId);
  const messageRef = doc(
    collection(db, "conversations", patientId, "messages"),
  );

  const batch = writeBatch(db);
  batch.set(messageRef, {
    senderId: auth.currentUser?.uid || null,
    senderRole,
    senderName,
    text: body,
    kind,
    explicitLanguage: containsExplicitLanguage(body),
    crisisLanguage: isCrisis,
    appointmentId,
    createdAt: serverTimestamp(),
  });
  batch.set(
    conversationRef,
    {
      patientId,
      ...(patientName ? { patientName } : {}),
      lastMessage: body.slice(0, 140),
      lastMessageAt: serverTimestamp(),
      lastSenderRole: senderRole,
      ...(fromPatient
        ? { unreadForStaff: increment(1) }
        : { unreadForPatient: increment(1) }),
    },
    { merge: true },
  );
  await batch.commit();

  if (notify && !fromPatient) {
    try {
      await createNotification({
        recipientId: patientId,
        patientId,
        type: "message",
        message: `New message from the practice: ${body.slice(0, 100)}`,
      });
    } catch (err) {
      console.error("Message sent, but the notification failed:", err);
    }
  }
  if (fromPatient) {
    try {
      await notifyAllSecretaries({
        patientId,
        type: "message",
        message: `New message from ${patientName || "a patient"}: ${body.slice(0, 100)}`,
      });
    } catch (err) {
      console.error(
        "Message sent, but the secretary notification failed:",
        err,
      );
    }
  }
  return messageRef.id;
}

export async function markConversationRead(patientId, role) {
  if (!patientId) return;
  await updateDoc(doc(db, "conversations", patientId), {
    [role === "patient" ? "unreadForPatient" : "unreadForStaff"]: 0,
  });
}