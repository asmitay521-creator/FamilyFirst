import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA4vQYHuBy0ngNlb8wquJaoCgg0UfqEwLc",
  authDomain: "familyfirst-e2079.firebaseapp.com",
  projectId: "familyfirst-e2079",
  storageBucket: "familyfirst-e2079.firebasestorage.app",
  messagingSenderId: "879553233203",
  appId: "1:879553233203:web:8f1e8fa3a8bd375edd7e46",
  measurementId: "G-7HT47DL4ZQ"
};

const app = getApps().some(a => a.name === "familyfirst-crm")
  ? getApp("familyfirst-crm")
  : initializeApp(firebaseConfig, "familyfirst-crm");

export const db = getFirestore(app);

export default app;
