"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  // Point authDomain at whatever origin is actually serving the app, so the
  // sign-in handler is same-origin. next.config.ts rewrites /__/auth/* to
  // Firebase's real handler. Falls back to the Firebase-hosted domain for
  // any non-browser context.
  authDomain:
    typeof window !== "undefined"
      ? window.location.hostname
      : "promptwar-501405.firebaseapp.com",
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

/** Errors where a popup can't work but a full-page redirect still can. */
const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth(), provider);
    return result.user;
  } catch (err) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code: unknown }).code)
        : "";

    // A blocked popup is a browser policy decision, not a dead end: send the
    // whole page to Google instead. Resolves as null because the result
    // arrives after navigation, via consumeRedirectResult on next load.
    if (REDIRECT_FALLBACK_CODES.has(code)) {
      await signInWithRedirect(auth(), provider);
      return null;
    }
    throw err;
  }
}

/** Picks up a sign-in that completed via the redirect path. */
export async function consumeRedirectResult(): Promise<User | null> {
  try {
    const result = await getRedirectResult(auth());
    return result?.user ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth());
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth(), cb);
}

export type { User };
