import { initializeApp, getApps, getApp, deleteApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyA4vQYHuBy0ngNlb8wquJaoCgg0UfqEwLc",
  authDomain: "familyfirst-e2079.firebaseapp.com",
  projectId: "familyfirst-e2079",
  storageBucket: "familyfirst-e2079.firebasestorage.app",
  messagingSenderId: "879553233203",
  appId: "1:879553233203:web:8f1e8fa3a8bd375edd7e46",
  measurementId: "G-7HT47DL4ZQ"
};

const app = getApps().some((a) => a.name === "familyfirst-crm")
  ? getApp("familyfirst-crm")
  : initializeApp(firebaseConfig, "familyfirst-crm");

export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Creates a new user in Firebase Authentication without logging out the currently logged-in admin.
 */
export const createFirebaseUserWithoutSignout = async (email: string, password?: string) => {
  if (!email || !email.includes('@')) return null;
  const tempPassword = password && password.trim().length >= 6 ? password.trim() : 'Pass@123456';
  const secondaryAppName = `sec-auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), tempPassword);
    await deleteApp(secondaryApp);
    return userCredential.user;
  } catch (err: any) {
    try { await deleteApp(secondaryApp); } catch {}
    if (err?.code === 'auth/email-already-in-use') {
      console.log('Firebase Auth: User already exists in Authentication:', email);
      return { email };
    }
    console.warn('Firebase Auth user creation notice:', err);
    return null;
  }
};

export default app;