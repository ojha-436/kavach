"use client";

import type { FirebaseApp } from "firebase/app";
import type { Auth, User } from "firebase/auth";

/**
 * Firebase web configuration.
 *
 * Worth being precise about what moving these into the environment does and
 * does not buy, because it is easy to mistake for a security fix. The web API
 * key is public by design: it ships inside the client bundle no matter where
 * it is stored, and Google documents it as an identifier rather than a
 * secret. What actually protects the project is the Firestore rules, the
 * Firebase authorised-domain list, and the API-key restrictions set in the
 * Cloud console — not the key's absence from a repository.
 *
 * What this does buy is real, if smaller: no credential-shaped literal sits
 * in source control, and the values can be rotated by redeploying rather than
 * by editing code.
 *
 * These are NEXT_PUBLIC_, so they are inlined at build time. That is
 * deliberate — reading them from an endpoint at runtime would put an await in
 * front of signInWithPopup, and a popup opened after an await has lost the
 * user gesture that lets it through the browser's popup blocker.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  // Must stay the Firebase-hosted domain. Pointing this at our own Cloud Run
  // host makes the SDK use https://<our-host>/__/auth/handler as the OAuth
  // redirect_uri, which is not registered on the OAuth client, and Google
  // rejects the sign-in with redirect_uri_mismatch. Only the firebaseapp.com
  // handler is registered by default.
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/**
 * A build without the configuration still has to produce a working app — CI
 * builds one to run the accessibility suite against, and it is given no
 * credentials on purpose. Rather than throwing at import time and taking
 * every page down with it, sign-in reports itself unavailable and the rest of
 * the app carries on: every feature except history works signed out.
 */
export function authConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.appId);
}

/**
 * The SDK is ~130 kB and nothing can be painted with it, so it is imported
 * dynamically rather than bundled into the first load of every page. The
 * promise is memoised and started from AuthProvider's mount effect, so it has
 * long resolved by the time anyone clicks "Sign in" — which matters, because
 * that click has to reach signInWithPopup with its user gesture intact.
 */
let authPromise: Promise<Auth> | null = null;

function loadAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
    ]);
    const app: FirebaseApp = getApps().length
      ? getApps()[0]
      : initializeApp(firebaseConfig);
    return getAuth(app);
  })();
  return authPromise;
}

/** Signals a build that was never given Firebase configuration. */
class AuthUnconfiguredError extends Error {
  readonly code = "auth/not-configured";
  constructor() {
    super("Firebase configuration is missing from this build.");
  }
}

/** Errors where a popup can't work but a full-page redirect still can. */
const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export async function signInWithGoogle(): Promise<User | null> {
  if (!authConfigured()) throw new AuthUnconfiguredError();

  const [auth, { GoogleAuthProvider, signInWithPopup, signInWithRedirect }] =
    await Promise.all([loadAuth(), import("firebase/auth")]);

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
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
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

/** Picks up a sign-in that completed via the redirect path. */
export async function consumeRedirectResult(): Promise<User | null> {
  if (!authConfigured()) return null;
  try {
    const [auth, { getRedirectResult }] = await Promise.all([
      loadAuth(),
      import("firebase/auth"),
    ]);
    return (await getRedirectResult(auth))?.user ?? null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  if (!authConfigured()) return;
  const [auth, { signOut: fbSignOut }] = await Promise.all([
    loadAuth(),
    import("firebase/auth"),
  ]);
  await fbSignOut(auth);
}

/**
 * Keeps a synchronous unsubscribe signature over an asynchronous subscribe,
 * so callers can return it straight from useEffect. Unsubscribing before the
 * SDK has loaded has to be remembered rather than ignored, otherwise a
 * component that unmounts during the import leaks a listener that outlives it.
 */
export function watchAuth(cb: (user: User | null) => void): () => void {
  if (!authConfigured()) {
    cb(null);
    return () => {};
  }

  let unsubscribe: (() => void) | null = null;
  let cancelled = false;

  void (async () => {
    try {
      const [auth, { onAuthStateChanged }] = await Promise.all([
        loadAuth(),
        import("firebase/auth"),
      ]);
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth, cb);
    } catch {
      // A failed SDK load is indistinguishable from signed out, as far as
      // anything rendering off this callback is concerned.
      if (!cancelled) cb(null);
    }
  })();

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export type { User };
