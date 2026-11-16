import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { db } from "./config";
import { subscribeToPatients, getAllPatients } from "./firestore";
import { dateAtAge, ageOn, CONSENT_AGE, MAJORITY_AGE } from "../utils/childAge";

const childrenCol = collection(db, "children");

export const RELATIONSHIPS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "legal_guardian", label: "Legal guardian" },
  { value: "other", label: "Other caregiver" },
];

export const CHILD_ID_TYPES = [
  { value: "sa_id", label: "SA ID number" },
  { value: "birth_certificate", label: "Birth certificate number" },
  { value: "none", label: "Not available yet" },
];

// ---------------------------------------------------------------------------
// Parent side
// ---------------------------------------------------------------------------

export function subscribeToMyChildren(guardianUid, onData, onError) {
  if (!guardianUid) return () => {};

  // No range filter on turns18At: combined with array-contains it needs a
  // composite index, and a client-clock bound cannot satisfy the rule's
  // request.time check. The 18+ cut-off is applied by isManageable() in
  // useChildren and enforced on single-record reads (allow get) in the rules.
  const q = query(
    childrenCol,
    where("guardianIds", "array-contains", guardianUid),
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) =>
          (a.dateOfBirth || "").localeCompare(b.dateOfBirth || ""),
        );

      onData(list);
    },
    onError,
  );
}

export function subscribeToChild(childId, onData, onError) {
  if (!childId) return () => {};

  return onSnapshot(
    doc(db, "children", childId),
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    onError,
  );
}

export async function addChild({
  guardian,
  firstName,
  lastName,
  dateOfBirth,
  relationship,
  idType = "none",
  idNumber = "",
}) {
  if (!guardian?.uid) {
    throw new Error("You must be signed in to add a child.");
  }

  const first = firstName.trim();
  const last = lastName.trim();

  const ref = await addDoc(childrenCol, {
    firstName: first,
    lastName: last,
    name: `${first} ${last}`,
    dateOfBirth,
    idType,
    idNumber: idNumber.trim(),

    guardianIds: [guardian.uid],
    primaryGuardianId: guardian.uid,

    guardians: {
      [guardian.uid]: {
        name: guardian.name || "",
        relationship,
      },
    },

    status: "managed",
    verificationStatus: "pending",

    turns12At: Timestamp.fromDate(dateAtAge(dateOfBirth, CONSENT_AGE)),

    turns18At: Timestamp.fromDate(dateAtAge(dateOfBirth, MAJORITY_AGE)),

    createdBy: guardian.uid,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

// ---------------------------------------------------------------------------
// Secretary side
// ---------------------------------------------------------------------------

const byName = (a, b) => (a.name || "").localeCompare(b.name || "");

export function childToPatient(child) {
  const guardian = child.guardians?.[child.primaryGuardianId] || {};

  return {
    id: child.id,
    role: "patient",
    isChild: true,

    name:
      child.name || `${child.firstName || ""} ${child.lastName || ""}`.trim(),

    firstName: child.firstName || "",
    dateOfBirth: child.dateOfBirth || "",
    idNumber: child.idNumber || "",
    idType: child.idType || "",

    profileCharacter: child.profileCharacter || "",

    email: "",
    phone: "",

    hasCompletedIntake: !!child.hasCompletedIntake,

    verificationStatus: child.verificationStatus || "pending",

    status: child.status || "managed",

    primaryGuardianId: child.primaryGuardianId || "",
    guardianName: guardian.name || "",
    guardianRelationship: guardian.relationship || "",
  };
}

export function subscribeToPatientsAndChildren(callback, onError) {
  let users = [];
  let kids = [];

  const emit = () => {
    callback([...users, ...kids].sort(byName));
  };

  const unsubUsers = subscribeToPatients((list) => {
    users = list;
    emit();
  });

  const unsubKids = onSnapshot(
    childrenCol,
    (snap) => {
      kids = snap.docs
        .map((d) =>
          childToPatient({
            id: d.id,
            ...d.data(),
          }),
        )
        .filter((c) => c.status !== "handed_over");

      emit();
    },
    (err) => {
      console.error("Could not load children:", err);
      if (onError) onError(err);
    },
  );

  return () => {
    if (unsubUsers) unsubUsers();
    if (unsubKids) unsubKids();
  };
}

export async function getAllPatientsAndChildren() {
  const [users, kidsSnap] = await Promise.all([
    getAllPatients(),

    getDocs(childrenCol).catch((err) => {
      console.error("Could not load children:", err);
      return { docs: [] };
    }),
  ]);

  const kids = kidsSnap.docs
    .map((d) =>
      childToPatient({
        id: d.id,
        ...d.data(),
      }),
    )
    .filter((c) => c.status !== "handed_over");

  return [...users, ...kids].sort(byName);
}

export async function getChildByIdNumber(idNumber) {
  const id = (idNumber || "").trim();

  if (!id) return null;

  try {
    const snap = await getDocs(query(childrenCol, where("idNumber", "==", id)));

    const match = snap.docs
      .map((d) => ({
        id: d.id,
        ...d.data(),
      }))
      .find((c) => c.status !== "handed_over");

    return match ? childToPatient(match) : null;
  } catch (err) {
    console.error("Child lookup by ID number failed:", err);
    return null;
  }
}

export async function setChildVerification(childId, status, staffUid) {
  await updateDoc(doc(db, "children", childId), {
    verificationStatus: status,
    reviewedBy: staffUid || null,
    reviewedAt: serverTimestamp(),
  });
}

export async function setChildCharacter(childId, character) {
  await updateDoc(doc(db, "children", childId), {
    profileCharacter: character || "",
  });
}

export async function markChildIntakeCompleted(childId) {
  await updateDoc(doc(db, "children", childId), {
    hasCompletedIntake: true,
    intakeCompletedAt: serverTimestamp(),
  });
}

export async function setChildIdNumber(childId, idType, idNumber) {
  await updateDoc(doc(db, "children", childId), {
    idType,
    idNumber: (idNumber || "").trim(),
  });
}

function coded(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function commitInChunks(ops, size = 400) {
  for (let i = 0; i < ops.length; i += size) {
    const batch = writeBatch(db);

    ops.slice(i, i + size).forEach((op) => op(batch));

    await batch.commit();
  }
}

export async function handOverChild(child, staffUid) {
  if (!child?.id) {
    throw coded("invalid", "No child selected.");
  }

  if (!child.dateOfBirth || ageOn(child.dateOfBirth) < MAJORITY_AGE) {
    throw coded("not-adult", "This patient is not 18 yet.");
  }

  const idNumber = (child.idNumber || "").trim();

  if (!idNumber) {
    throw coded(
      "no-id",
      "Add their ID number first. It is how their own account is found.",
    );
  }

  const accountSnap = await getDocs(
    query(
      collection(db, "users"),
      where("idNumber", "==", idNumber),
      where("role", "==", "patient"),
    ),
  );

  if (accountSnap.empty) {
    throw coded(
      "no-account",
      `No Now Med patient account uses ID number ${idNumber} yet. Ask them to sign up with that number, then hand over again.`,
    );
  }

  if (accountSnap.size > 1) {
    throw coded(
      "ambiguous",
      "More than one account uses that ID number. Please sort that out first.",
    );
  }

  const adult = {
    id: accountSnap.docs[0].id,
    ...accountSnap.docs[0].data(),
  };

  if (adult.id === child.id) {
    throw coded("invalid", "That account is the child profile itself.");
  }

  const moved = {
    appointments: 0,
    records: 0,
    profile: 0,
    intakeForms: 0,
    notifications: 0,
    messages: 0,
  };

  const ops = [];

  async function repoint(col, field, key, patchFor) {
    const snap = await getDocs(
      query(collection(db, col), where(field, "==", child.id)),
    );

    snap.docs.forEach((d) => {
      ops.push((b) => b.update(d.ref, patchFor(d.data())));
    });

    if (key) {
      moved[key] += snap.size;
    }
  }

  await repoint("appointments", "patientId", "appointments", () => ({
    patientId: adult.id,
    patientName: adult.name || child.name,
  }));

  await repoint("appointmentSlots", "patientId", null, () => ({
    patientId: adult.id,
  }));

  await repoint("records", "patientId", "records", () => ({
    patientId: adult.id,
  }));

  await repoint("patientProfiles", "patientId", "profile", () => ({
    patientId: adult.id,
  }));

  await repoint("intakeForms", "patientId", "intakeForms", () => ({
    patientId: adult.id,
  }));

  await repoint("notifications", "recipientId", "notifications", (data) =>
    data.patientId === child.id
      ? {
          recipientId: adult.id,
          patientId: adult.id,
        }
      : {
          recipientId: adult.id,
        },
  );

  await commitInChunks(ops);

  const oldConvRef = doc(db, "conversations", child.id);

  const oldConv = await getDoc(oldConvRef);

  if (oldConv.exists()) {
    const oldMessages = await getDocs(
      collection(db, "conversations", child.id, "messages"),
    );

    const newConvRef = doc(db, "conversations", adult.id);

    const newConv = await getDoc(newConvRef);

    const o = oldConv.data();
    const n = newConv.exists() ? newConv.data() : {};

    const latest =
      (o.lastMessageAt?.seconds || 0) >= (n.lastMessageAt?.seconds || 0)
        ? o
        : n;

    const copyOps = oldMessages.docs.map(
      (m) => (b) =>
        b.set(doc(db, "conversations", adult.id, "messages", m.id), m.data()),
    );

    copyOps.push((b) =>
      b.set(
        newConvRef,
        {
          patientId: adult.id,
          patientName: adult.name || child.name,

          lastMessage: latest.lastMessage || "",

          ...(latest.lastMessageAt
            ? { lastMessageAt: latest.lastMessageAt }
            : {}),

          lastSenderRole: latest.lastSenderRole || "secretary",

          unreadForStaff: (o.unreadForStaff || 0) + (n.unreadForStaff || 0),

          unreadForPatient:
            (o.unreadForPatient || 0) + (n.unreadForPatient || 0),
        },
        { merge: true },
      ),
    );

    await commitInChunks(copyOps);

    moved.messages = oldMessages.size;

    const cleanup = oldMessages.docs.map((m) => (b) => b.delete(m.ref));

    cleanup.push((b) => b.delete(oldConvRef));

    await commitInChunks(cleanup);
  }

  let characterCopied = false;
  if (child.profileCharacter && !adult.profileCharacter) {
    try {
      await updateDoc(doc(db, "users", adult.id), {
        profileCharacter: child.profileCharacter,
      });
      characterCopied = true;
    } catch (err) {
      console.error("Could not copy profile character to adult account:", err);
    }
  }

  await updateDoc(doc(db, "children", child.id), {
    status: "handed_over",
    handedOverTo: adult.id,
    handedOverAt: serverTimestamp(),
    handedOverBy: staffUid || null,
  });

  return {
    adultId: adult.id,
    adultName: adult.name || "",
    characterCopied,
    moved,
  };
}
