import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB1X4UJaDWkn8YZ0c7vy8b7MejGNhphy5Y",
  authDomain: "now-med-edebf.firebaseapp.com",
  projectId: "now-med-edebf",
  storageBucket: "now-med-edebf.firebasestorage.app",
  messagingSenderId: "997992642587",
  appId: "1:997992642587:web:5be2cea39ea923395be0be"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Use tab-scoped sessionStorage instead of the default shared
// localStorage persistence, so each browser tab can hold its own
// logged-in user (useful for testing multiple roles at once, and
// avoids one tab's login silently kicking out another tab's user).
setPersistence(auth, browserSessionPersistence);

export const db = getFirestore(app, 'jj04');  // 👈 add your database name here
export default app;