// One-off script to seed a few fake reviews for demo doctors.
// Run from the project root with:
//
//   SEED_SECRETARY_EMAIL=you@practice.com SEED_SECRETARY_PASSWORD=yourpassword node scripts/seedDoctorReviews.mjs
//
// Requires the deployed firestore.rules to include the isSecretary()
// bypass on doctorRatings' `create` rule (added alongside this script) -
// without it, this will 403 the same way the app would.

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  query,
  where,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB1X4UJaDWkn8YZ0c7vy8b7MejGNhphy5Y",
  authDomain: "now-med-edebf.firebaseapp.com",
  projectId: "now-med-edebf",
  storageBucket: "now-med-edebf.firebasestorage.app",
  messagingSenderId: "997992642587",
  appId: "1:997992642587:web:5be2cea39ea923395be0be",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "jj04"); // same named database the app uses

// Edit these freely - each entry is { doctorNameMatch, reviews: [...] }
// doctorNameMatch is matched case-insensitively against doctors.name.
const SEED = [
  {
    doctorNameMatch: "House",
    reviews: [
      { rating: 5, comment: "Rude, but he was right about the diagnosis. Worth it." },
      { rating: 4, comment: "Took a while to get an actual answer, but got there." },
      { rating: 3, comment: "Brilliant, but bedside manner needs work." },
    ],
  },
  {
    doctorNameMatch: "Grey",
    reviews: [
      { rating: 5, comment: "Incredibly thorough and explained everything clearly." },
      { rating: 5, comment: "Made a stressful visit feel completely manageable." },
      { rating: 4, comment: "Great doctor, ran a bit behind schedule." },
    ],
  },
  {
    doctorNameMatch: "Murphy",
    reviews: [
      { rating: 5, comment: "Noticed something two other doctors missed. Fantastic." },
      { rating: 4, comment: "A little literal in conversation but extremely precise." },
      { rating: 5, comment: "Best diagnostic experience I've had at this practice." },
    ],
  },
];

async function main() {
  const email = process.env.SEED_SECRETARY_EMAIL;
  const password = process.env.SEED_SECRETARY_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Set SEED_SECRETARY_EMAIL and SEED_SECRETARY_PASSWORD env vars to a real secretary login before running this.",
    );
  }

  await signInWithEmailAndPassword(auth, email, password);
  console.log(`Signed in as ${email}`);

  const doctorsSnap = await getDocs(collection(db, "doctors"));
  const doctors = doctorsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  for (const entry of SEED) {
    const doctor = doctors.find((d) =>
      (d.name || "").toLowerCase().includes(entry.doctorNameMatch.toLowerCase()),
    );
    if (!doctor) {
      console.warn(`No doctor found matching "${entry.doctorNameMatch}" - skipping.`);
      continue;
    }

    for (const [i, r] of entry.reviews.entries()) {
      // Fake but stable appointmentId, since doctorRatings' doc ID *is*
      // the appointmentId - doesn't need to correspond to a real
      // appointment, doctorRatings has no such dependency.
      const fakeAppointmentId = `seed_${doctor.id}_${i}`;
      const patientId = `seed-patient-${doctor.id}-${i}`;

      await setDoc(doc(db, "doctorRatings", fakeAppointmentId), {
        appointmentId: fakeAppointmentId,
        doctorId: doctor.id,
        patientId,
        rating: r.rating,
        comment: r.comment,
        hidden: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      console.log(`Seeded review for ${doctor.name}: ${r.rating}* "${r.comment}"`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
