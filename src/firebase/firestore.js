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
  writeBatch,
  runTransaction,
  Timestamp,
  orderBy,
  limit,
  increment,
} from "firebase/firestore";
import { db, auth } from "./config";

// ---------- Collections ----------
const usersCol = collection(db, "users");
const appointmentsCol = collection(db, "appointments");
const notificationsCol = collection(db, "notifications");
const blockedSlotsCol = collection(db, "blockedSlots");
const recordsCol = collection(db, "records");
// Clinical profile data (medical history, allergies, medications, etc.) that
// doesn't belong on the users doc and isn't a single dated record. One doc
// per patient, looked up the same way as records — by patientId once
// registered, or by patientIdNumber before that (see linkPatientDataByIdNumber).
const profilesCol = collection(db, "patientProfiles");
// Full first-time intake form answers (one doc per patient). Kept separate
// from patientProfiles because patients may only write a handful of
// non-clinical profile fields, but the intake form also collects
// patient-reported clinical history. A secretary reviews it and can import it
// into the verified profile from the patient's record.
const intakeFormsCol = collection(db, "intakeForms");
// Patient requests to change details they can't edit themselves (clinical
// data, date of birth, gender...). A secretary actions them from the record.
const changeRequestsCol = collection(db, "changeRequests");
// One chat per patient: conversations/{patientId} holds the summary + unread
// counters, conversations/{patientId}/messages holds the messages.
const conversationsCol = collection(db, "conversations");

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

// Reserves this ID/passport number for a new account, using the
// idNumberIndex collection instead of querying `users` directly (a
// brand-new registrant can't query `users` — see the firestore.rules
// comment on idNumberIndex). Mirrors the rules exactly:
//   - a role slot that's already taken -> rejected
//   - the one exception: an existing secretary may also claim the
//     patient slot under the same ID number
// Throws an Error with code 'duplicate-id-number' on any other clash,
// so SignUp.jsx's existing catch for that code keeps working unchanged.
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
          "An account with this ID/passport number already exists. Please log in instead, or contact the practice if you believe this is a mistake."
        );
        err.code = "duplicate-id-number";
        throw err;
      }
      // existing.secretaryUid must be set (doc exists) — matches the
      // rule's allowed update path.
      transaction.update(ref, { patientUid: uid });
      return;
    }

    // role === 'secretary': rules have no update path for the secretary
    // slot at all, so any existing doc means this ID number is taken.
    const err = new Error(
      "An account with this ID/passport number already exists. Please log in instead, or contact the practice if you believe this is a mistake."
    );
    err.code = "duplicate-id-number";
    throw err;
  });
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

// Live subscription version of getPatientRecords — used by the patient's
// own Medical Records page (and dashboard preview) so a record a secretary
// adds or edits shows up within moments, without a manual refresh.
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

// Lets a secretary add a medical record for a patient. If the patient has
// no account yet, pass patientId: null and patientIdNumber instead — the
// record will be linked automatically once they register (see
// linkPatientDataByIdNumber).
//
// `type` distinguishes a quick free-text note ("note", the original shape —
// just title/date/notes) from a full consultation entry ("consultation"),
// which can also carry doctor, reason for visit, diagnosis, treatment,
// follow-up flag, and a vitals snapshot. All the consultation-only fields
// are optional so existing calls that only pass title/date/notes keep working.
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
  // Staff-only entries (e.g. sensitive internal notes) are stored like any
  // other record but filtered out of every patient-facing read. Defaults to
  // false so existing calls behave exactly as before.
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

// ================= PATIENT CLINICAL PROFILE =================
// Personal/medical-history data shown on the secretary's patient overview:
// blood group, allergies, chronic conditions, current medications, surgical
// history, hospital admissions, family history, emergency contact, medical
// aid, etc. Kept in its own collection (rather than on the users doc) so it
// can exist for walk-in patients before they have an account, same pattern
// as records.

export async function getPatientProfile(patientId) {
  if (!patientId) return null;
  const q = query(profilesCol, where("patientId", "==", patientId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// Live subscription version of getPatientProfile — used by the patient's
// own Medical Records page so edits a secretary makes (allergies, chronic
// conditions, medications, etc.) appear within moments. Also picks up the
// patient's own edits to the handful of fields they're allowed to update
// (see savePatientProfile call sites), so the secretary sees those quickly
// the next time they open this patient's record.
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

// Upsert: pass the existing profile's `id` (as `profileId`) to update it,
// or omit it to create a new profile doc for this patient/walk-in.
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
    // Store the exact appointment date/time as a Firestore Timestamp so
    // security rules can enforce the 3-hour patient cancellation window.
    appointmentAt:
      data.appointmentAt ||
      Timestamp.fromDate(new Date(`${data.date}T${data.time}:00`)),
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
  };

  // The old version of this function checked bookedSlots on the client
  // before calling addDoc(). That's a check-then-act race: two people
  // can both pass the client-side check for the same date+time and both
  // end up calling addDoc within moments of each other, so both get an
  // appointment - a double booking. (This is the shared, practice-wide
  // calendar - the existing UI's own conflict check is date+time only,
  // not scoped per doctor, so we mirror that here.)
  //
  // A Firestore transaction closes that race: the read (checking for an
  // existing active appointment at this date+time) and the write
  // (creating this one) happen as a single atomic unit. If two clients
  // race, Firestore guarantees only one transaction commits - the other
  // automatically retries, sees the just-created appointment on its
  // re-read, and fails with 'slot-taken' instead of silently
  // double-booking the slot.
  //
  // Note: this makes concurrent *legitimate app usage* safe. It is not
  // itself a security rule - a client that bypasses this function and
  // writes to /appointments directly could still create a conflicting
  // document, because the current security rules only check who is
  // allowed to create an appointment, not whether the slot is already
  // taken. See the note in firestore.rules for how to close that gap
  // server-side if this needs to be a hard guarantee rather than an
  // app-level one.
  await runTransaction(db, async (transaction) => {
    const conflictQuery = query(
      appointmentsCol,
      where("date", "==", data.date),
      where("time", "==", data.time),
    );
    const conflictSnap = await transaction.get(conflictQuery);
    const hasActiveConflict = conflictSnap.docs.some(
      (d) => d.data().status !== "cancelled",
    );

    if (hasActiveConflict) {
      const error = new Error(
        "Sorry, that slot was just booked by someone else. Please pick another time.",
      );
      error.code = "slot-taken";
      throw error;
    }

    transaction.set(appointmentRef, newAppointment);
  });

  // Only registered patients (with a uid) can receive an in-app notification.
  // Kept outside the transaction - it's a side effect of a successful
  // booking, not something that needs to roll back together with it.
  if (patientId) {
    await createNotification({
      recipientId: patientId,
      appointmentId: appointmentRef.id,
      type: "confirmation",
      message: `Your appointment on ${data.date} at ${data.time} has been confirmed.`,
    });
    // Fire-and-forget - a slow/failed intake check should never hold up
    // returning the new appointment id to the caller.
    notifyIfIntakeIncomplete(patientId, data.patientName, data.date, data.time);
  }

  return appointmentRef.id;
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
    batch.update(d.ref, {
      patientId: uid,
      patientName: name || d.data().patientName,
    });
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
  await updateDoc(doc(db, "appointments", appointmentId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAppointment(appointmentId) {
  await deleteDoc(doc(db, "appointments", appointmentId));
}

export async function cancelAppointment(appointment, userId, options = {}) {
  if (!appointment?.id) throw new Error("Missing appointment id.");

  // The 3-hour window is a patient-facing rule (don't let someone cancel
  // online at the last minute) - it was never meant to stop the practice's
  // own staff from cancelling an appointment whenever they need to. Pass
  // { isStaff: true } from secretary/staff call sites to skip it.
  const { isStaff = false } = options;

  if (!isStaff) {
    // The Firestore rule is the final authority. This check is only here so
    // the patient gets a friendly message instead of a permission error.
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

// Secretary marks that the patient arrived late (the reverse of
// markAppointmentDelay above - "dual accountability" per the PRD, so the
// practice has a record of lateness on both sides). Deliberately does NOT
// touch the main `status` field: the patient still attended and whatever
// status applied before (booked/confirmed) still applies, this is an
// orthogonal record of lateness, not a replacement status.
export async function markPatientLate(appointment, minutesLate, note) {
  await updateAppointment(appointment.id, {
    patientLateMinutes: minutesLate,
    patientLateNote: note || "",
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
    const message = `Please confirm your appointment on ${appointment.date} at ${appointment.time}. Reply via WhatsApp, call, or email to let us know you'll be attending.`;
    await createNotification({
      recipientId: appointment.patientId,
      appointmentId: appointment.id,
      type: "reminder",
      message,
    });

    // Also drop the reminder into the patient's chat so it's part of the
    // conversation history. A chat failure must never undo the reminder
    // itself, so it's logged rather than thrown.
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

// The notifications collection is per-recipient (recipientId), so there's no
// built-in "everyone with this role" broadcast. This fans a single alert out
// to every secretary account by creating one notification doc each. Used for
// things any secretary should see and act on (a patient's intake still isn't
// done ahead of their visit, a message got flagged for review), rather than
// things tied to one specific patient's own chat/booking.
async function notifyAllSecretaries({ type, message, appointmentId = null, patientId = null }) {
  const q = query(usersCol, where("role", "==", "secretary"));
  const snap = await getDocs(q);
  await Promise.all(
    snap.docs.map((d) =>
      createNotification({
        recipientId: d.id,
        appointmentId,
        patientId,
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
  type,
  message,
}) {
  await addDoc(notificationsCol, {
    recipientId,
    appointmentId,
    patientId,
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

// Bulk-clears every unread "new message" bell notification for one user.
// The chat page itself only resets the conversation's unreadForPatient/
// unreadForStaff counter (see markConversationRead) - that's a different
// piece of state to the individual notification docs sendMessage() creates
// for the bell, so without this those kept piling up as unread even after
// the patient had already read the message in the chat.
export async function markMessageNotificationsRead(recipientId, patientId) {
  if (!recipientId || !patientId) return;
  const q = query(
    notificationsCol,
    where("recipientId", "==", recipientId),
    where("type", "==", "message"),
    where("read", "==", false),
  );
  const snap = await getDocs(q);
  const matchingDocs = snap.docs.filter((d) => d.data().patientId === patientId);
  if (matchingDocs.length === 0) return;
  const batch = writeBatch(db);
  matchingDocs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
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

// ================= DOCTORS =================
// One doc per doctor at the practice, editable by any secretary. Patients
// pick one of these when booking (see createAppointment's doctorId/doctorName),
// but the schedule/calendar itself stays shared across all doctors rather
// than being split per-doctor.

const doctorsCol = collection(db, "doctors");

// Live subscription — used wherever the doctor list should stay in sync as
// the secretary adds/edits/removes doctors (secretary profile, patient
// dashboard, booking flow).
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

// One-time fetch, for places that don't need live updates.
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
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDoctor(doctorId) {
  await deleteDoc(doc(db, "doctors", doctorId));
}
// ================= INTAKE FORMS =================
// `answers` is the raw output of the digital intake wizard (see
// utils/intakeQuestions.js). Like records/profiles, a form can be attached
// to an ID number before the patient has an account (patientId: null) and is
// linked to their uid at registration by linkPatientDataByIdNumber.

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
  const q = query(intakeFormsCol, where("patientIdNumber", "==", idNumber));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// The first-login check: is there already an intake form for this patient,
// either under their uid or linked to their ID/passport number?
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
}) {
  const ref = await addDoc(intakeFormsCol, {
    patientId,
    patientIdNumber: patientIdNumber || "",
    answers,
    submittedBy,
    importedAt: null,
    submittedAt: serverTimestamp(),
  });
  return ref.id;
}

// Attaches an existing ID-number-only form to a registered patient's uid.
export async function linkIntakeFormToPatient(intakeId, patientId) {
  await updateDoc(doc(db, "intakeForms", intakeId), { patientId });
}

// Secretary copied the patient-reported answers into the verified profile.
export async function markIntakeImported(intakeId, staffUid) {
  await updateDoc(doc(db, "intakeForms", intakeId), {
    importedAt: serverTimestamp(),
    importedBy: staffUid || null,
  });
}

// "Send reminder" button on a patient's record (see IntakeStatusCard). Only
// meaningful for a registered patient - a walk-in with no account has
// nowhere for the reminder to land, so the caller should keep that button
// hidden for them (it already does: `patient.id &&` guards it).
export async function sendIntakeReminder(patient) {
  if (!patient?.id) {
    throw new Error("This patient doesn't have an account yet to send a reminder to.");
  }
  await createNotification({
    recipientId: patient.id,
    type: "intake_reminder",
    message: "Please complete your first-time patient intake form before your next visit.",
  });
  // Also drop it in their chat with the practice, same as an appointment
  // reminder, so it's hard to miss even if they don't check the bell.
  await sendMessage({
    patientId: patient.id,
    patientName: patient.name || "",
    senderRole: "secretary",
    senderName: "Practice",
    text: "Hi! Could you please complete your first-time patient intake form before your next visit? You can find it from your dashboard.",
    kind: "reminder",
  });
}

// Checked right after booking a *registered* patient's appointment. If they
// still haven't completed (or even started) their intake form, every
// secretary gets a heads-up now rather than finding out when the patient
// arrives. There's no server-side scheduler in this app to fire this closer
// to the actual visit, so "at booking time" is the one reliable moment we
// know both facts (a real upcoming appointment, and intake status) at once.
async function notifyIfIntakeIncomplete(patientId, patientName, date, time) {
  try {
    const userDoc = await getDoc(doc(db, "users", patientId));
    const data = userDoc.exists() ? userDoc.data() : null;
    if (data && data.hasCompletedIntake) return;
    const form = await getIntakeFormForPatient(patientId, data?.idNumber);
    if (form) return; // form exists but the user doc hasn't caught up yet
    await notifyAllSecretaries({
      type: "intake_incomplete",
      message: `${patientName || "A patient"} has an appointment on ${date} at ${time} but hasn't completed their intake form yet.`,
    });
  } catch (err) {
    // Best-effort - never let a notification failure block a booking.
    console.error("Could not check/notify about intake status:", err);
  }
}

// ================= CHANGE REQUESTS =================
// Patients can directly edit non-clinical details only. For anything else
// they file a request here; a secretary makes the change on the record (or
// declines it) and the patient is notified either way.

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
    status: "pending", // 'pending' | 'completed' | 'declined'
    resolutionNote: "",
    resolvedBy: null,
    resolvedAt: null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

const byNewest = (a, b) =>
  (b.createdAt?.seconds || Number.MAX_SAFE_INTEGER) -
  (a.createdAt?.seconds || Number.MAX_SAFE_INTEGER);

// One patient's requests (patient view and the secretary's patient record).
export function subscribeToPatientChangeRequests(patientId, callback, onError) {
  if (!patientId) return () => {};
  const q = query(changeRequestsCol, where("patientId", "==", patientId));
  return onSnapshot(
    q,
    (snap) =>
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest)),
    onError,
  );
}

// Every request still waiting on a secretary (dashboard).
export function subscribeToPendingChangeRequests(callback, onError) {
  const q = query(changeRequestsCol, where("status", "==", "pending"));
  return onSnapshot(
    q,
    (snap) =>
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest)),
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
}

// ================= MESSAGING =================
// A patient has one chat with "the practice" (any secretary can read and
// reply). Unread counters live on the conversation doc so the sidebar badge
// and the inbox list don't have to read every message.

export function subscribeToConversation(patientId, callback, onError) {
  if (!patientId) return () => {};
  return onSnapshot(
    doc(db, "conversations", patientId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

// Secretary inbox: every conversation, most recent activity first.
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

// Latest 200 messages, oldest first.
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

// Deliberately short and conservative - this is a first pass at flagging
// obvious explicit language for a secretary to glance at, not a full
// profanity/moderation service. It never blocks sending: a patient in
// distress or pain shouldn't be stopped from reaching the practice, but the
// practice should be able to see at a glance which messages used explicit
// language so they can follow up with care if needed.
const EXPLICIT_LANGUAGE_PATTERN =
  /\b(fuck(ing|er|ed)?|shit(ty)?|bitch(es)?|asshole|bastard|cunt|dick(head)?|piss(ed)?off|whore|slut)\b/i;

function containsExplicitLanguage(text) {
  return EXPLICIT_LANGUAGE_PATTERN.test(text || "");
}

// Posts a message and updates the conversation summary + the *other* side's
// unread counter in one batch. `kind: "reminder"` marks system reminders so
// the chat can style them differently. Pass `notify: true` when a secretary
// is writing a normal message and the patient should also get a bell
// notification (reminders create their own notification, so they don't).
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
  if (containsExplicitLanguage(body)) {
    const error = new Error("This message can't be sent because it contains inappropriate language.");
    error.code = "inappropriate-language";
    throw error;
  }
  const fromPatient = senderRole === "patient";

  const conversationRef = doc(db, "conversations", patientId);
  const messageRef = doc(collection(db, "conversations", patientId, "messages"));

  const batch = writeBatch(db);
  batch.set(messageRef, {
    senderId: auth.currentUser?.uid || null,
    senderRole,
    senderName,
    text: body,
    kind,
    explicitLanguage: containsExplicitLanguage(body),
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
      console.error("Message sent, but the secretary notification failed:", err);
    }
  }
  return messageRef.id;
}

// Resets the unread counter for whoever just opened the chat.
export async function markConversationRead(patientId, role) {
  if (!patientId) return;
  await updateDoc(doc(db, "conversations", patientId), {
    [role === "patient" ? "unreadForPatient" : "unreadForStaff"]: 0,
  });
}