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
  setDoc,
} from "firebase/firestore";
import { db, auth } from "./config";

// ---------- Collections ----------
const usersCol = collection(db, "users");
const appointmentsCol = collection(db, "appointments");
// Mirrors just { date, time, status, appointmentId } for every active
// appointment, one doc per date+time slot (see appointmentSlotId). Exists
// because two things legitimately need a practice-wide view across every
// patient's bookings - the patient calendar (subscribeToBookedSlots) and
// the double-booking conflict check inside createAppointment - and neither
// of those reads can be scoped to one patientId, so they can never satisfy
// the (correctly) per-patient /appointments read rule: Firestore rejects a
// list query outright unless the rule can be proven true for every
// possible result using only the query's own filters. Keying by the slot
// itself (rather than by appointmentId) also turns the conflict check into
// a single-document transaction.get() - see the note on createAppointment.
// This collection carries no patient-identifying data, so any signed-in
// user can read it; it's kept in lockstep with the real appointment doc by
// createAppointment/updateAppointment/deleteAppointment below, so nothing
// else should write to it directly.
const appointmentSlotsCol = collection(db, "appointmentSlots");
// appointmentSlots docs are keyed by the slot itself, not the appointment,
// so a conflict check is a single doc read (see createAppointment) and two
// different appointments can never collide on the same slot doc ID.
function appointmentSlotId(date, time, doctorId = null) {
  return doctorId ? `${date}_${time}_${doctorId}` : `${date}_${time}`;
}
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
const analyticsEventsCol = collection(db, "analyticsEvents");
const analyticsSummaryCol = collection(db, "analyticsSummary");

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
          "An account with this ID/passport number already exists. Please log in instead, or contact the practice if you believe this is a mistake.",
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
      "An account with this ID/passport number already exists. Please log in instead, or contact the practice if you believe this is a mistake.",
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
// Reads the appointmentSlots mirror (see its declaration above) rather than
// appointmentsCol directly, since a patient's read access to /appointments
// is scoped to their own docs and can't satisfy this unfiltered, practice-
// wide query.
export function subscribeToBookedSlots(callback) {
  return onSnapshot(appointmentSlotsCol, (snap) => {
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
  // The conflict check itself has to be a single-document read, not a
  // query: the web SDK's Transaction.get() only accepts a
  // DocumentReference, not a Query (unlike the Admin/mobile SDKs) - passing
  // it a query throws a TypeError trying to read a `.path` that only a doc
  // ref has. So the slot doc below is keyed deterministically by the slot
  // itself (`date_time`) rather than by appointmentId, which turns "is
  // this date+time already booked" into one transaction.get(docRef) - and,
  // as a side benefit, is exactly the "deterministic per-slot document ID"
  // the old note here said would be needed to make double-booking
  // prevention a hard, rule-checkable guarantee rather than only an
  // app-level one.
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
      // Carried on the slot doc itself (not just the appointment) so its
      // security rule can check ownership without a cross-document get() -
      // get()/exists() in rules only see state from before this commit
      // started, never a sibling write in the same transaction/batch, so a
      // rule that tried to look up *this* appointment doc (being created
      // in this same transaction) to authorize *this* slot write would
      // always see it as not-yet-existing and get denied. A plain UID
      // here is low-risk to expose to any signed-in user (same tradeoff as
      // idNumberIndex above) - it can't be resolved to a name/phone/etc.
      // without also passing the separate, tighter /users read rule.
      patientId,
    });
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

  if (newAppointment.doctorId) {
    await syncDoctorAnalyticsFromAppointment({
      doctorId: newAppointment.doctorId,
      doctorName: newAppointment.doctorName || "Doctor",
      appointmentDate: newAppointment.date,
    });
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
    const data = d.data();
    batch.update(d.ref, {
      patientId: uid,
      patientName: name || data.patientName,
    });
    // Keep the appointmentSlots mirror's patientId in step, so the patient
    // can actually cancel this appointment afterward (the slot doc's own
    // update rule checks resource.data.patientId directly - see the
    // firestore.rules comment on appointmentSlots).
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

// Every status change (cancel, confirm, delay, unconfirm) funnels through
// here, so mirroring into appointmentSlots in one place - in the same
// batch as the real update - keeps the calendar/conflict-check view
// consistent without every call site having to remember to do it.
// Slot docs are keyed by date_time (see appointmentSlotId), not by
// appointmentId, so a `time` (or `date`) change moves the lock: the old
// slot doc is freed and a new one is created at the new slot. This needs
// the appointment's current date/time first, which a batch - like a
// transaction - can't read via a query, only get() by reference; that
// single extra read happens outside the batch, so (same as the note on
// createAppointment) a reschedule isn't conflict-checked as atomically as
// a fresh booking is - consistent with how reschedule already worked
// before this mirror existed.
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

// Patient self-report: "my live ETA says I won't make it in time." Set from
// PatientETA once a driving-time calculation puts their estimated arrival
// past the practice's recommended arrival buffer (see isNewPatient logic in
// PatientDashboard). This is deliberately a separate pair of fields from
// patientLateMinutes/patientLateNote above - those are the secretary's own
// after-the-fact record of actual lateness; these are the patient's own
// advance warning before they've even arrived. A patient may only ever set
// patientRunningLate to true (see the matching firestore.rules branch) -
// clearing it back to false once they've arrived or the secretary has seen
// it is a staff action, via acknowledgePatientRunningLate below.
export async function reportPatientRunningLate(appointmentId, minutesLate) {
  await updateDoc(doc(db, "appointments", appointmentId), {
    patientRunningLate: true,
    patientRunningLateMinutes: minutesLate ?? null,
    patientRunningLateAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// Secretary dismisses the running-late flag once seen (or once the patient
// has arrived). Plain updateAppointment is fine here - isSecretary() already
// has an unrestricted bypass on the appointments update rule.
export async function acknowledgePatientRunningLate(appointmentId) {
  await updateAppointment(appointmentId, {
    patientRunningLate: false,
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
async function notifyAllSecretaries({
  type,
  message,
  appointmentId = null,
  patientId = null,
  changeRequestId = null,
}) {
  const q = query(usersCol, where("role", "==", "secretary"));
  const snap = await getDocs(q);
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

// Removes every secretary's "new change request" bell notification tied to
// one request, once it's been actioned - see resolveChangeRequest below.
// Without this the notification (and anything on a dashboard reading the
// same collection) would sit there indefinitely even after the request is
// long since handled.
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

// Bulk-clears every unread bell notification tied to the patient's own
// chat with the practice - "message" (a reply came in), "reminder" (an
// appointment nudge), and "intake_reminder" (all three route into
// PatientMessages via NotificationBell's CHAT_NOTIFICATION_TYPES). Call
// this once the patient has actually opened the chat and seen them, so the
// bell badge clears instead of sitting on "unread" forever. Scoped by
// recipientId alone (not patientId, unlike markMessageNotificationsRead
// below) because a patient only ever has one chat - their own - so every
// notification of these types addressed to them belongs to it.
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
  const matchingDocs = snap.docs.filter(
    (d) => d.data().patientId === patientId,
  );
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
// field for backwards compatibility with any older code/reads. Give `doctorId`
// to make this a doctor-specific unavailability block; leave it blank for a
// practice-wide closure affecting everyone.
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

// Blocks a set of time slots (e.g. every 30-min slot between 12:00-13:00
// for a lunch break) as one titled group, so they can be shown and removed
// together instead of one-by-one. Pass the slot list already computed by
// the caller (see generateTimeSlots in utils/dateHelpers).
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
const doctorRatingsCol = collection(db, "doctorRatings");

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
    profileCharacter: data.profileCharacter || "",
    // Location & ETA groundwork: address is what the secretary types in;
    // lat/lng are filled in by geocodeAddress() (utils/googleMaps.js)
    // before this is called, so the ETA calculation never has to geocode
    // on every patient page load. Default to null rather than omitting
    // the fields, so "no location set yet" is explicit and easy to check
    // for (e.g. only show the "get ETA" button when doctor.lat is set).
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

// ================= DOCTOR RATINGS / REVIEWS =================
// One review per appointment, enforced by using the appointmentId itself
// as the doctorRatings document ID (rather than a random addDoc ID +
// a query). Two side effects of that choice, both wanted:
//   - "has this appointment been reviewed yet" is a single getDoc, not a
//     query - used by ReviewPrompt.jsx.
//   - a patient physically cannot create two reviews for the same
//     appointment; the second attempt is an update to the same doc, not a
//     second doc.
// `hidden` is the secretary's moderation flag - a hidden review still
// exists (for the record / for the patient who wrote it) but is excluded
// from every patient-facing read.

export async function syncDoctorAnalyticsFromAppointment({
  doctorId,
  doctorName,
  appointmentDate,
} = {}) {
  if (!doctorId || !appointmentDate) return;

  const doctor = (await getDoctorById(doctorId)) || {
    name: doctorName || "Doctor",
  };
  const date = new Date(`${appointmentDate}T12:00:00`);
  const monthKey = date.toISOString().slice(0, 7);
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diffToMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  const weekKey = weekStart.toISOString().slice(0, 10);

  for (const period of [
    { periodType: "month", periodKey: monthKey },
    { periodType: "week", periodKey: weekKey },
  ]) {
    const summary = await getAnalyticsSummary({
      entityType: "doctor",
      entityId: doctorId,
      periodType: period.periodType,
      periodKey: period.periodKey,
    });
    const current = summary[0] || {};
    const totalAppointments = Number(current.totalAppointments || 0) + 1;

    await upsertAnalyticsSummary({
      entityType: "doctor",
      entityId: doctorId,
      periodType: period.periodType,
      periodKey: period.periodKey,
      doctorName: doctor.name || current.doctorName || "Doctor",
      totalAppointments,
      reviewCount: Number(current.reviewCount || 0),
      avgReviewRating: current.avgReviewRating ?? 0,
      lateArrivalCount: Number(current.lateArrivalCount || 0),
      lateFeesCharged: Number(current.lateFeesCharged || 0),
      lastAppointmentAt: serverTimestamp(),
    });
  }
}

export async function syncDoctorAnalyticsFromLateArrival({
  doctorId,
  doctorName,
  appointmentDate,
  minuteDelta,
  note = "",
  source = "patient",
} = {}) {
  if (!doctorId || !appointmentDate) return;

  const doctor = (await getDoctorById(doctorId)) || {
    name: doctorName || "Doctor",
  };
  const date = new Date(`${appointmentDate}T12:00:00`);
  const monthKey = date.toISOString().slice(0, 7);
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diffToMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  const weekKey = weekStart.toISOString().slice(0, 10);

  const entry = {
    doctorId,
    doctorName: doctor.name || doctorName || "Doctor",
    source,
    note: note || "",
    minutesLate: Number(minuteDelta || 0),
    appointmentDate,
    createdAt: new Date().toISOString(),
  };

  for (const period of [
    { periodType: "month", periodKey: monthKey },
    { periodType: "week", periodKey: weekKey },
  ]) {
    const summary = await getAnalyticsSummary({
      entityType: "doctor",
      entityId: doctorId,
      periodType: period.periodType,
      periodKey: period.periodKey,
    });
    const current = summary[0] || {};
    const details = Array.isArray(current.lateArrivalDetails)
      ? current.lateArrivalDetails
      : [];

    await upsertAnalyticsSummary({
      entityType: "doctor",
      entityId: doctorId,
      periodType: period.periodType,
      periodKey: period.periodKey,
      doctorName: doctor.name || current.doctorName || "Doctor",
      totalAppointments: Number(current.totalAppointments || 0),
      reviewCount: Number(current.reviewCount || 0),
      avgReviewRating: current.avgReviewRating ?? 0,
      lateArrivalCount: Number(current.lateArrivalCount || 0) + 1,
      lateArrivalDetails: [...details, entry],
      lateFeesCharged: Number(current.lateFeesCharged || 0),
      lastLateArrivalAt: serverTimestamp(),
    });
  }
}

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

export async function syncDoctorAnalyticsFromReviews({
  doctorId,
  patientId,
  appointmentId,
  rating,
  comment = "",
} = {}) {
  if (!doctorId) return;

  const doctor = await getDoctorById(doctorId);
  const reviewDate = new Date();
  const monthKey = reviewDate.toISOString().slice(0, 7);
  const weekStart = new Date(reviewDate);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diffToMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  const weekKey = weekStart.toISOString().slice(0, 10);

  const periods = [
    { periodType: "month", periodKey: monthKey },
    { periodType: "week", periodKey: weekKey },
  ];

  for (const period of periods) {
    const summary = await getAnalyticsSummary({
      entityType: "doctor",
      entityId: doctorId,
      periodType: period.periodType,
      periodKey: period.periodKey,
    });
    const current = summary[0] || {};
    const reviewCount = Number(current.reviewCount || 0) + 1;
    const weighted =
      Number(current.avgReviewRating || 0) * Number(current.reviewCount || 0);
    const avgReviewRating = reviewCount
      ? (weighted + Number(rating ?? 0)) / reviewCount
      : Number(rating ?? 0);

    await upsertAnalyticsSummary({
      entityType: "doctor",
      entityId: doctorId,
      periodType: period.periodType,
      periodKey: period.periodKey,
      doctorName: doctor?.name || current.doctorName || "Doctor",
      reviewCount,
      avgReviewRating,
      lastReviewAt: serverTimestamp(),
    });
  }

  if (rating !== undefined && patientId && appointmentId) {
    await addDoc(analyticsEventsCol, {
      eventType: "doctor_review_submitted",
      entityType: "doctor",
      entityId: doctorId,
      patientId,
      appointmentId,
      rating,
      comment,
      createdAt: serverTimestamp(),
    });
  }
}

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

// Patient editing their own already-submitted review.
export async function updateDoctorRating(appointmentId, { rating, comment }) {
  await updateDoc(doc(doctorRatingsCol, appointmentId), {
    rating,
    comment,
    updatedAt: serverTimestamp(),
  });
}

// Secretary moderation: hide/unhide without touching the review content.
export async function setDoctorRatingHidden(appointmentId, hidden) {
  await updateDoc(doc(doctorRatingsCol, appointmentId), {
    hidden,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDoctorRating(appointmentId) {
  await deleteDoc(doc(doctorRatingsCol, appointmentId));
}

// One-time lookup used by the review prompt to check "has the patient
// already reviewed this specific appointment" before offering to show the
// prompt for it.
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

// Patient/dashboard-facing: only ever the visible (non-hidden) reviews for
// one doctor, live. The where('hidden','==',false) clause here isn't just
// a display filter - it's what lets the Firestore rule
// (`allow read: if isSecretary() || resource.data.hidden == false`) permit
// this as a list query at all; a query without it would be rejected the
// moment a hidden review existed in the collection.
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

// Secretary-facing moderation feed: every review, hidden or not, across all
// doctors. Allowed by the rule because isSecretary() is true for the
// caller, independent of the hidden field.
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
    throw new Error(
      "This patient doesn't have an account yet to send a reminder to.",
    );
  }
  await createNotification({
    recipientId: patient.id,
    type: "intake_reminder",
    message:
      "Please complete your first-time patient intake form before your next visit.",
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

  // Let every secretary know there's something to action - tagged with
  // changeRequestId so resolveChangeRequest can clear it again once it's
  // been dealt with (see deleteChangeRequestNotifications).
  try {
    await notifyAllSecretaries({
      type: "change_request",
      patientId,
      changeRequestId: ref.id,
      message: `${patientName || "A patient"} requested a change to their ${(section || "details").toLowerCase()}.`,
    });
  } catch (err) {
    // Best-effort - the request itself has already been saved either way.
    console.error("Change request saved, but the secretary notification failed:", err);
  }

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
      callback(
        snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNewest),
      ),
    onError,
  );
}

// Every request still waiting on a secretary (dashboard).
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

// First pass at flagging obvious explicit/harassing language for a
// secretary to glance at - not a full profanity/moderation service.
// Matches whole words only (\b...\b) so e.g. "assessment" or "class" don't
// trip the "ass" entry.
const EXPLICIT_LANGUAGE_PATTERN =
  /\b(fuck(ing|er|ed)?|shit(ty)?|bitch(es)?|ass(hole)?|bastard|cunt|dick(head)?|piss(ed)?\s*off|whore|slut|hoe|sexy|voetsek)\b/i;

// Sexually-harassing phrases worth catching even though no single word in
// them is on the list above (e.g. "sexy" alone can be innocuous elsewhere -
// "what are you wearing" is only a problem as a phrase directed at someone).
const HARASSMENT_PHRASE_PATTERN =
  /\byou'?re\s+so\s+sexy\b|\bwhat\s+are\s+you\s+wearing\b|\bsend\s+(me\s+)?(a\s+)?(nude|pic(ture)?s?)\b/i;

function containsExplicitLanguage(text) {
  const body = text || "";
  return (
    EXPLICIT_LANGUAGE_PATTERN.test(body) || HARASSMENT_PHRASE_PATTERN.test(body)
  );
}

// Separate, and deliberately NOT part of containsExplicitLanguage: these are
// possible self-harm/crisis phrases, not profanity. A patient in real
// distress must never be blocked from reaching the practice, so this is
// only ever used to flag a message for urgent attention after it has
// already been sent - never to stop it from sending. See sendMessage below.
const CRISIS_LANGUAGE_PATTERN =
  /\b(kill\s+(myself|yourself)|kms|suicide|suicidal|end\s+my\s+life|end\s+it\s+all|self[- ]harm|want(ed)?\s+to\s+die|don'?t\s+want\s+to\s+live)\b/i;

function containsCrisisLanguage(text) {
  return CRISIS_LANGUAGE_PATTERN.test(text || "");
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
  // Crisis language (possible self-harm) is checked first and is exempt
  // from the block below on purpose - see CRISIS_LANGUAGE_PATTERN. It only
  // ever flags the message so staff can follow up urgently once sent.
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

// Resets the unread counter for whoever just opened the chat.
export async function markConversationRead(patientId, role) {
  if (!patientId) return;
  await updateDoc(doc(db, "conversations", patientId), {
    [role === "patient" ? "unreadForPatient" : "unreadForStaff"]: 0,
  });
}