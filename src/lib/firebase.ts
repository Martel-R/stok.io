
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCWJ97gYG4fkUB0IbBXYl4dHStCg_yOTGw",
  authDomain: "stok-io.firebaseapp.com",
  projectId: "stok-io",
  storageBucket: "stok-io.appspot.com",
  messagingSenderId: "226589234695",
  appId: "1:226589234695:web:f7879c220bddd3c195fca2",
  measurementId: "G-5NVZSN17E6"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
