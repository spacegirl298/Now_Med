// Security rules tests, run against the local Firestore emulator.
//
//   npm run test:rules
//
// Each test is one claim from the report, written as something that either
// succeeds or is rejected by the rules. Nothing here touches the live project.
import { readFileSync } from 'node:fs'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const HOUR = 60 * 60 * 1000
let testEnv

// ---- who is calling -------------------------------------------------------
// Patients: verified email, no invite.
const patient = (uid) =>
  testEnv
    .authenticatedContext(uid, { email: `${uid}@test.com`, email_verified: true })
    .firestore()

// Secretary: verified email that is on the staffInvites list (see seed()).
const secretary = () =>
  testEnv
    .authenticatedContext('sec1', { email: 'sec@practice.com', email_verified: true })
    .firestore()

// Invited email, but the address has not been verified yet.
const unverifiedStaff = () =>
  testEnv
    .authenticatedContext('sec2', { email: 'new@practice.com', email_verified: false })
    .firestore()

const userDoc = (uid, role = 'patient', extra = {}) => ({
  uid,
  name: `User ${uid}`,
  email: `${uid}@test.com`,
  role,
  idNumber: `id-${uid}`,
  idType: 'sa_id',
  hasCompletedIntake: false,
  createdAt: Timestamp.now(),
  ...extra,
})

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'staffInvites/sec@practice.com'), { by: 'console' })
    await setDoc(doc(db, 'staffInvites/new@practice.com'), { by: 'console' })
    await setDoc(doc(db, 'secretaryDirectory/sec1'), { uid: 'sec1' })

    await setDoc(doc(db, 'users/patA'), userDoc('patA'))
    await setDoc(doc(db, 'users/patB'), userDoc('patB'))
    await setDoc(doc(db, 'users/sec1'), userDoc('sec1', 'secretary', { email: 'sec@practice.com' }))

    // patA has one appointment 4 hours out and one 2 hours out; patB has one.
    const appt = (patientId, hoursAhead) => ({
      patientId,
      doctorId: 'doc1',
      status: 'confirmed',
      date: '2030-01-01',
      time: '10:00',
      appointmentAt: Timestamp.fromMillis(Date.now() + hoursAhead * HOUR),
    })
    await setDoc(doc(db, 'appointments/apptA4h'), appt('patA', 4))
    await setDoc(doc(db, 'appointments/apptA2h'), appt('patA', 2))
    await setDoc(doc(db, 'appointments/apptB'), appt('patB', 6))

    await setDoc(doc(db, 'records/recB'), { patientId: 'patB', notes: 'private' })
    await setDoc(doc(db, 'intakeForms/intakeB'), { patientId: 'patB', submittedBy: 'patient' })
    await setDoc(doc(db, 'patientProfiles/profB'), { patientId: 'patB', allergies: 'private' })
    await setDoc(doc(db, 'conversations/patB'), { patientId: 'patB' })
    await setDoc(doc(db, 'conversations/patB/messages/m1'), {
      senderId: 'patB',
      senderRole: 'patient',
      kind: 'message',
      text: 'private',
    })
    await setDoc(doc(db, 'analyticsSummary/doctor_doc1_month_2030-01'), {
      entityType: 'doctor',
      entityId: 'doc1',
      periodType: 'month',
      periodKey: '2030-01',
      totalAppointments: 10,
    })
  })
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-now-med',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})
afterAll(async () => {
  await testEnv.cleanup()
})
beforeEach(async () => {
  await testEnv.clearFirestore()
  await seed()
})

// ---------------------------------------------------------------------------
describe('user documents (names, emails, ID numbers)', () => {
  it('a patient can read their own user doc', async () => {
    await assertSucceeds(getDoc(doc(patient('patA'), 'users/patA')))
  })
  it("a patient cannot read another patient's user doc", async () => {
    await assertFails(getDoc(doc(patient('patA'), 'users/patB')))
  })
  it('a patient cannot list the users collection', async () => {
    await assertFails(getDocs(collection(patient('patA'), 'users')))
  })
  it('a patient cannot look up secretaries by role', async () => {
    const q = query(collection(patient('patA'), 'users'), where('role', '==', 'secretary'))
    await assertFails(getDocs(q))
  })
  it('a secretary can list users', async () => {
    await assertSucceeds(getDocs(collection(secretary(), 'users')))
  })
})

describe('role assignment', () => {
  it('a new account can be created as a patient', async () => {
    const db = patient('newPat')
    await assertSucceeds(setDoc(doc(db, 'users/newPat'), userDoc('newPat')))
  })
  it('a new account cannot be created as a secretary without an invite', async () => {
    const db = patient('evil')
    await assertFails(setDoc(doc(db, 'users/evil'), userDoc('evil', 'secretary')))
  })
  it('an invited email can create a secretary account', async () => {
    const db = unverifiedStaff()
    await assertSucceeds(
      setDoc(doc(db, 'users/sec2'), userDoc('sec2', 'secretary', { email: 'new@practice.com' })),
    )
  })
  it('a user cannot change their own role', async () => {
    await assertFails(updateDoc(doc(patient('patA'), 'users/patA'), { role: 'secretary' }))
  })
  it('a user cannot change their own ID number', async () => {
    await assertFails(updateDoc(doc(patient('patA'), 'users/patA'), { idNumber: 'id-patB' }))
  })
  it('a user can still edit their own name and phone', async () => {
    await assertSucceeds(
      updateDoc(doc(patient('patA'), 'users/patA'), { name: 'New Name', phone: '0710000000' }),
    )
  })
  it('a user cannot create a user doc under someone else\'s uid', async () => {
    await assertFails(setDoc(doc(patient('patA'), 'users/patX'), userDoc('patX')))
  })
})

describe('privilege escalation (the practice-code attack)', () => {
  it('a user doc that says role=secretary gives no access to records', async () => {
    // Simulates the old exploit: someone who managed to write role=secretary.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/evil'), userDoc('evil', 'secretary'))
    })
    const db = patient('evil')
    await assertFails(getDoc(doc(db, 'records/recB')))
    await assertFails(getDoc(doc(db, 'intakeForms/intakeB')))
    await assertFails(getDoc(doc(db, 'patientProfiles/profB')))
    await assertFails(getDoc(doc(db, 'conversations/patB/messages/m1')))
    await assertFails(getDocs(collection(db, 'users')))
  })
  it('an invited email that is not verified yet has no secretary access', async () => {
    await assertFails(getDoc(doc(unverifiedStaff(), 'records/recB')))
  })
  it('an invited, verified secretary can read patient records', async () => {
    const db = secretary()
    await assertSucceeds(getDoc(doc(db, 'records/recB')))
    await assertSucceeds(getDoc(doc(db, 'intakeForms/intakeB')))
    await assertSucceeds(getDoc(doc(db, 'conversations/patB/messages/m1')))
  })
  it('a patient cannot add themselves to the staff invite list', async () => {
    await assertFails(setDoc(doc(patient('patA'), 'staffInvites/patA@test.com'), { by: 'me' }))
  })
  it("a patient cannot read someone else's invite", async () => {
    await assertFails(getDoc(doc(patient('patA'), 'staffInvites/sec@practice.com')))
  })
  it('a secretary can invite a colleague', async () => {
    await assertSucceeds(setDoc(doc(secretary(), 'staffInvites/colleague@practice.com'), { by: 'sec1' }))
  })
})

describe("patient A cannot reach patient B's data", () => {
  it('appointment', async () => {
    await assertFails(getDoc(doc(patient('patA'), 'appointments/apptB')))
  })
  it('appointment query for another patient', async () => {
    const q = query(collection(patient('patA'), 'appointments'), where('patientId', '==', 'patB'))
    await assertFails(getDocs(q))
  })
  it('medical record', async () => {
    await assertFails(getDoc(doc(patient('patA'), 'records/recB')))
  })
  it('intake form', async () => {
    await assertFails(getDoc(doc(patient('patA'), 'intakeForms/intakeB')))
  })
  it('patient profile', async () => {
    await assertFails(getDoc(doc(patient('patA'), 'patientProfiles/profB')))
  })
  it('chat messages', async () => {
    await assertFails(getDoc(doc(patient('patA'), 'conversations/patB/messages/m1')))
  })
  it('A can read their own appointment', async () => {
    await assertSucceeds(getDoc(doc(patient('patA'), 'appointments/apptA4h')))
  })
})

describe('patient cancellation window (3 hours)', () => {
  const cancel = (db, id, extra = {}) =>
    updateDoc(doc(db, `appointments/${id}`), {
      status: 'cancelled',
      cancelledAt: Timestamp.now(),
      cancelledBy: 'patA',
      updatedAt: Timestamp.now(),
      ...extra,
    })

  it('succeeds 4 hours before the appointment', async () => {
    await assertSucceeds(cancel(patient('patA'), 'apptA4h'))
  })
  it('is rejected 2 hours before the appointment', async () => {
    await assertFails(cancel(patient('patA'), 'apptA2h'))
  })
  it("a patient cannot cancel someone else's appointment", async () => {
    await assertFails(cancel(patient('patA'), 'apptB', { cancelledBy: 'patA' }))
  })
  it('a cancellation cannot change other fields', async () => {
    await assertFails(cancel(patient('patA'), 'apptA4h', { doctorId: 'someone-else' }))
  })
  it('a secretary can cancel inside the window', async () => {
    await assertSucceeds(updateDoc(doc(secretary(), 'appointments/apptA2h'), { status: 'cancelled' }))
  })
})

describe('analytics summaries', () => {
  const id = 'analyticsSummary/doctor_doc1_month_2030-01'
  it('a patient cannot overwrite an existing summary', async () => {
    await assertFails(updateDoc(doc(patient('patA'), id), { totalAppointments: 999 }))
  })
  it('a patient cannot create a summary', async () => {
    await assertFails(
      setDoc(doc(patient('patA'), 'analyticsSummary/doctor_doc2_week_2030-01-01'), {
        entityType: 'doctor',
        entityId: 'doc2',
        periodType: 'week',
        periodKey: '2030-01-01',
      }),
    )
  })
  it('a patient cannot write analytics events', async () => {
    await assertFails(setDoc(doc(patient('patA'), 'analyticsEvents/e1'), { eventType: 'x' }))
  })
  it('a patient cannot read analytics', async () => {
    await assertFails(getDoc(doc(patient('patA'), id)))
  })
  it('a secretary can read and update summaries', async () => {
    await assertSucceeds(getDoc(doc(secretary(), id)))
    await assertSucceeds(updateDoc(doc(secretary(), id), { totalAppointments: 11 }))
  })
})

describe('doctor reviews', () => {
  const review = (patientId, appointmentId) => ({
    patientId,
    appointmentId,
    doctorId: 'doc1',
    rating: 5,
    comment: 'Great',
    hidden: false,
  })
  it('a patient can review their own appointment', async () => {
    await assertSucceeds(setDoc(doc(patient('patA'), 'doctorRatings/apptA4h'), review('patA', 'apptA4h')))
  })
  it("a patient cannot review someone else's appointment", async () => {
    await assertFails(setDoc(doc(patient('patA'), 'doctorRatings/apptB'), review('patA', 'apptB')))
  })
})

describe('secretary directory', () => {
  it('a patient can read it (uids only) to notify staff', async () => {
    await assertSucceeds(getDocs(collection(patient('patA'), 'secretaryDirectory')))
  })
  it('a patient cannot add themselves to it', async () => {
    await assertFails(setDoc(doc(patient('patA'), 'secretaryDirectory/patA'), { uid: 'patA' }))
  })
  it('a verified, invited secretary can register themselves', async () => {
    await assertSucceeds(setDoc(doc(secretary(), 'secretaryDirectory/sec1'), { uid: 'sec1' }))
  })
})
