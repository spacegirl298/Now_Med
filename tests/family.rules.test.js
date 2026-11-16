// Security rules tests for the secretary side of the family feature:
// listing and confirming children, booking and messaging for them, refusing a
// guardian, and the hand-over to an adult account at 18.

import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  writeBatch,
  collection,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;
const ID = "0101015009087";
let testEnv;

const at = (ms) => Timestamp.fromMillis(Date.now() + ms);

const parent = (uid) =>
  testEnv
    .authenticatedContext(uid, {
      email: `${uid}@test.com`,
      email_verified: true,
    })
    .firestore();
const secretary = () =>
  testEnv
    .authenticatedContext("sec1", {
      email: "sec@practice.com",
      email_verified: true,
    })
    .firestore();

const childDoc = (extra = {}) => ({
  firstName: "Kid",
  lastName: "Test",
  name: "Kid Test",
  dateOfBirth: "2018-01-01",
  idType: "none",
  idNumber: "",
  guardianIds: ["parentA"],
  primaryGuardianId: "parentA",
  guardians: { parentA: { name: "Parent A", relationship: "mother" } },
  status: "managed",
  verificationStatus: "pending",
  turns12At: at(4 * YEAR),
  turns18At: at(10 * YEAR),
  createdBy: "parentA",
  createdAt: Timestamp.now(),
  ...extra,
});

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "staffInvites/sec@practice.com"), { by: "console" });
    await setDoc(doc(db, "secretaryDirectory/sec1"), { uid: "sec1" });

    // The young adult's own account (patient), and a staff member who shares
    // an ID number with a patient account
    await setDoc(doc(db, "users/adult1"), {
      uid: "adult1",
      name: "Alex Adult",
      email: "adult1@test.com",
      role: "patient",
      idNumber: ID,
      idType: "sa_id",
    });

    await setDoc(
      doc(db, "children/kidPending"),
      childDoc({ idNumber: "1801015009087", idType: "sa_id" }),
    );
    await setDoc(
      doc(db, "children/kidRejected"),
      childDoc({ verificationStatus: "rejected" }),
    );
    // turned 18 yesterday, ready to be handed over
    await setDoc(
      doc(db, "children/kidGrown"),
      childDoc({
        verificationStatus: "verified",
        idNumber: ID,
        idType: "sa_id",
        turns12At: at(-6 * YEAR),
        turns18At: at(-DAY),
      }),
    );

    // data belonging to the child who is being handed over
    await setDoc(doc(db, "appointments/apptGrown"), {
      patientId: "kidGrown",
      patientName: "Kid Test",
      doctorId: "doc1",
      status: "confirmed",
      date: "2030-01-01",
      time: "10:00",
      appointmentAt: at(5 * DAY),
    });
    await setDoc(doc(db, "appointmentSlots/slotGrown"), {
      date: "2030-01-01",
      time: "10:00",
      status: "booked",
      appointmentId: "apptGrown",
      patientId: "kidGrown",
      doctorId: "doc1",
    });
    await setDoc(doc(db, "records/recGrown"), {
      patientId: "kidGrown",
      notes: "history",
    });
    await setDoc(doc(db, "patientProfiles/profGrown"), {
      patientId: "kidGrown",
      allergies: "none",
    });
    await setDoc(doc(db, "intakeForms/intakeGrown"), {
      patientId: "kidGrown",
      submittedBy: "secretary",
    });
    await setDoc(doc(db, "notifications/nGrown"), {
      recipientId: "kidGrown",
      patientId: "kidGrown",
      type: "message",
      message: "hi",
      read: false,
    });
    await setDoc(doc(db, "conversations/kidGrown"), {
      patientId: "kidGrown",
      lastMessage: "see you",
      lastSenderRole: "secretary",
      unreadForStaff: 0,
      unreadForPatient: 1,
    });
    await setDoc(doc(db, "conversations/kidGrown/messages/m1"), {
      senderId: "parentA",
      senderRole: "patient",
      kind: "message",
      text: "hello",
    });
    await setDoc(doc(db, "conversations/kidGrown/messages/m2"), {
      senderId: "sec1",
      senderRole: "secretary",
      kind: "message",
      text: "see you",
    });

    // a refused guardian's child, with data parentA must no longer reach
    await setDoc(doc(db, "appointments/apptRejected"), {
      patientId: "kidRejected",
      doctorId: "doc1",
      status: "confirmed",
      date: "2030-01-01",
      time: "11:00",
      appointmentAt: at(5 * DAY),
    });
    await setDoc(doc(db, "conversations/kidRejected"), {
      patientId: "kidRejected",
      unreadForStaff: 0,
      unreadForPatient: 0,
    });
    await setDoc(doc(db, "conversations/kidRejected/messages/m1"), {
      senderId: "sec1",
      senderRole: "secretary",
      kind: "message",
      text: "hi",
    });
    await setDoc(doc(db, "notifications/nRejected"), {
      recipientId: "kidRejected",
      type: "message",
      message: "x",
      read: false,
    });
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-now-med-secretary",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});
afterAll(async () => {
  await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await seed();
});

describe("the secretary can see and confirm children", () => {
  it("lists every child (the patient directory query)", async () => {
    await assertSucceeds(getDocs(collection(secretary(), "children")));
  });
  it("finds a child by ID number (the booking form lookup)", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(secretary(), "children"),
          where("idNumber", "==", "1801015009087"),
        ),
      ),
    );
  });
  it("a patient cannot list all children", async () => {
    await assertFails(getDocs(collection(parent("parentA"), "children")));
  });
  it("a guardian can list their own children with the real subscription query", async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(parent("parentA"), "children"),
          where("guardianIds", "array-contains", "parentA"),
        ),
      ),
    );
  });
  it("a guardian cannot list another guardian's children", async () => {
    await assertFails(
      getDocs(
        query(
          collection(parent("parentA"), "children"),
          where("guardianIds", "array-contains", "parentB"),
        ),
      ),
    );
  });
  it("confirms, refuses and undoes a guardian", async () => {
    const db = secretary();
    const set = (status) =>
      updateDoc(doc(db, "children/kidPending"), {
        verificationStatus: status,
        reviewedBy: "sec1",
        reviewedAt: serverTimestamp(),
      });
    await assertSucceeds(set("verified"));
    await assertSucceeds(set("rejected"));
    await assertSucceeds(set("pending"));
  });
  it("adds an ID number to a child profile", async () => {
    await assertSucceeds(
      updateDoc(doc(secretary(), "children/kidRejected"), {
        idType: "sa_id",
        idNumber: ID,
      }),
    );
  });
  it("a parent cannot confirm themselves or edit the ID number", async () => {
    const db = parent("parentA");
    await assertFails(
      updateDoc(doc(db, "children/kidPending"), {
        verificationStatus: "verified",
      }),
    );
    await assertFails(
      updateDoc(doc(db, "children/kidPending"), { idNumber: "9999999999999" }),
    );
  });
});

describe("the secretary works with a child like any patient", () => {
  it("books an appointment, its slot and the notification for a child", async () => {
    const db = secretary();
    const batch = writeBatch(db);
    batch.set(doc(db, "appointments/new1"), {
      patientId: "kidPending",
      patientName: "Kid Test",
      doctorId: "doc1",
      status: "booked",
      date: "2030-02-01",
      time: "09:00",
      appointmentAt: at(30 * DAY),
    });
    batch.set(doc(db, "appointmentSlots/slotNew"), {
      date: "2030-02-01",
      time: "09:00",
      status: "booked",
      appointmentId: "new1",
      patientId: "kidPending",
      doctorId: "doc1",
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(
      addDoc(collection(db, "notifications"), {
        recipientId: "kidPending",
        type: "confirmation",
        message: "booked",
        read: false,
        createdAt: serverTimestamp(),
      }),
    );
  });
  it("messages a child's conversation", async () => {
    const db = secretary();
    const batch = writeBatch(db);
    batch.set(doc(collection(db, "conversations/kidPending/messages")), {
      senderId: "sec1",
      senderRole: "secretary",
      senderName: "Practice",
      text: "Hello",
      kind: "message",
    });
    batch.set(
      doc(db, "conversations/kidPending"),
      {
        patientId: "kidPending",
        lastMessage: "Hello",
        lastSenderRole: "secretary",
        unreadForPatient: 1,
      },
      { merge: true },
    );
    await assertSucceeds(batch.commit());
  });
  it("writes a record and a profile for a child", async () => {
    const db = secretary();
    await assertSucceeds(
      setDoc(doc(db, "records/newRec"), {
        patientId: "kidPending",
        patientIdNumber: "",
        notes: "checkup",
      }),
    );
    await assertSucceeds(
      setDoc(doc(db, "patientProfiles/newProf"), {
        patientId: "kidPending",
        allergies: "pollen",
      }),
    );
  });
});

describe("a guardian the practice refuses", () => {
  const db = () => parent("parentA");
  it("can still read the child profile, so the app can explain what happened", async () => {
    await assertSucceeds(getDoc(doc(db(), "children/kidRejected")));
  });

  it("loses access to appointments", async () => {
    await assertFails(getDoc(doc(db(), "appointments/apptRejected")));
    await assertFails(
      getDocs(
        query(
          collection(db(), "appointments"),
          where("patientId", "==", "kidRejected"),
        ),
      ),
    );
  });
  it("loses access to the chat", async () => {
    await assertFails(getDoc(doc(db(), "conversations/kidRejected")));
    await assertFails(
      getDoc(doc(db(), "conversations/kidRejected/messages/m1")),
    );
  });
  it("loses access to notifications", async () => {
    await assertFails(
      getDocs(
        query(
          collection(db(), "notifications"),
          where("recipientId", "==", "kidRejected"),
        ),
      ),
    );
  });
  it("cannot book for the child", async () => {
    await assertFails(
      setDoc(doc(db(), "appointments/sneaky"), {
        patientId: "kidRejected",
        date: "2030-03-01",
      }),
    );
  });
  it("regains access if the practice undoes the decision", async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      updateDoc(doc(ctx.firestore(), "children/kidRejected"), {
        verificationStatus: "pending",
      }),
    );
    await assertSucceeds(getDoc(doc(db(), "appointments/apptRejected")));
  });
});

describe("handing a child over to their own account at 18", () => {
  // Same writes as handOverChild() in src/firebase/family.js.
  async function handOver() {
    const db = secretary();
    // 1. find the adult: patient role + ID number
    await assertSucceeds(
      getDocs(
        query(
          collection(db, "users"),
          where("idNumber", "==", ID),
          where("role", "==", "patient"),
        ),
      ),
    );

    // 2. re-point the child's data to the adult
    const b1 = writeBatch(db);
    b1.update(doc(db, "appointments/apptGrown"), {
      patientId: "adult1",
      patientName: "Alex Adult",
    });
    b1.update(doc(db, "appointmentSlots/slotGrown"), { patientId: "adult1" });
    b1.update(doc(db, "records/recGrown"), { patientId: "adult1" });
    b1.update(doc(db, "patientProfiles/profGrown"), { patientId: "adult1" });
    b1.update(doc(db, "intakeForms/intakeGrown"), { patientId: "adult1" });
    b1.update(doc(db, "notifications/nGrown"), {
      recipientId: "adult1",
      patientId: "adult1",
    });
    await assertSucceeds(b1.commit());

    // 3. copy the chat, then remove the child's copy
    const b2 = writeBatch(db);
    b2.set(doc(db, "conversations/adult1/messages/m1"), {
      senderId: "parentA",
      senderRole: "patient",
      kind: "message",
      text: "hello",
    });
    b2.set(doc(db, "conversations/adult1/messages/m2"), {
      senderId: "sec1",
      senderRole: "secretary",
      kind: "message",
      text: "see you",
    });
    b2.set(
      doc(db, "conversations/adult1"),
      {
        patientId: "adult1",
        patientName: "Alex Adult",
        lastMessage: "see you",
        lastSenderRole: "secretary",
        unreadForStaff: 0,
        unreadForPatient: 1,
      },
      { merge: true },
    );
    await assertSucceeds(b2.commit());
    const b3 = writeBatch(db);
    b3.delete(doc(db, "conversations/kidGrown/messages/m1"));
    b3.delete(doc(db, "conversations/kidGrown/messages/m2"));
    b3.delete(doc(db, "conversations/kidGrown"));
    await assertSucceeds(b3.commit());

    // 4. mark the child profile handed over
    await assertSucceeds(
      updateDoc(doc(db, "children/kidGrown"), {
        status: "handed_over",
        handedOverTo: "adult1",
        handedOverAt: serverTimestamp(),
        handedOverBy: "sec1",
      }),
    );
  }

  it("lets staff run every step of the hand-over", async () => {
    await handOver();
  });
  it("afterwards the adult can see their own history", async () => {
    await handOver();
    const adult = parent("adult1");
    await assertSucceeds(getDoc(doc(adult, "appointments/apptGrown")));
    await assertSucceeds(getDoc(doc(adult, "records/recGrown")));
    await assertSucceeds(getDoc(doc(adult, "patientProfiles/profGrown")));
    await assertSucceeds(
      getDoc(doc(adult, "conversations/adult1/messages/m1")),
    );
    await assertSucceeds(
      getDocs(
        query(
          collection(adult, "notifications"),
          where("recipientId", "==", "adult1"),
        ),
      ),
    );
  });
  it("afterwards the former guardian cannot see any of it", async () => {
    await handOver();
    const old = parent("parentA");
    await assertFails(getDoc(doc(old, "appointments/apptGrown")));
    await assertFails(getDoc(doc(old, "records/recGrown")));
    await assertFails(getDoc(doc(old, "conversations/adult1/messages/m1")));
  });
  it("the adult can still cancel the appointment that was moved to them", async () => {
    await handOver();
    await assertSucceeds(
      updateDoc(doc(parent("adult1"), "appointments/apptGrown"), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: "adult1",
        updatedAt: serverTimestamp(),
      }),
    );
  });
  it("a parent cannot run the hand-over themselves", async () => {
    const db = parent("parentA");
    await assertFails(
      updateDoc(doc(db, "records/recGrown"), { patientId: "parentA" }),
    );
    await assertFails(
      updateDoc(doc(db, "appointments/apptGrown"), { patientId: "parentA" }),
    );
    await assertFails(
      updateDoc(doc(db, "children/kidGrown"), { status: "handed_over" }),
    );
  });
});
