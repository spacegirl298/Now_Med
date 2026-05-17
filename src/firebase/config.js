import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
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
export const db = getFirestore(app, 'jj04');  // 👈 add your database name here
export default app;