
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "hunger-free-and-happy-app",
  "appId": "1:1002580546718:web:a8574bfc3732c7c137978f",
  "storageBucket": "hunger-free-and-happy-app.appspot.com",
  "apiKey": "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  "authDomain": "hunger-free-and-happy-app.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1002580546718"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Conditionally initialize messaging only on the client side
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;


export { app, db, auth, storage, messaging };
