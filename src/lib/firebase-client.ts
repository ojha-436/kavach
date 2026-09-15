"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

/**
 * Firebase web config is public by design — it ships inside the client
 * bundle no matter where it is stored, and Google documents it as not a
 * secret. Access is controlled by Firestore security rules and by API-key
 * restrictions in the Cloud console, not by hiding these values.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAGR3gKivNJlDIWmq-DPDVIQEd5SSeR-3c",
  authDomain: "promptwar-501405.firebaseapp.com",
  projectId: "promptwar-501405",
  storageBucket: "promptwar-501405.firebasestorage.app",
  messagingSenderId: "823065407403",
  appId: "1:823065407403:web:6c6002088ece3c9082acee",
};

function app(): FirebaseApp {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export function auth() {
  return getAuth(app());
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(auth(), provider);
  return result.user;
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth());
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth(), cb);
}

export type { User };
