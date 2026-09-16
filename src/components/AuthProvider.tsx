"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  watchAuth,
  signInWithGoogle,
  signOut,
  consumeRedirectResult,
  type User,
} from "@/lib/firebase-client";

type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  dismissError: () => void;
  /** Bearer token for our own API routes; null when signed out. */
  token: () => Promise<string | null>;
  /**
   * fetch with the caller's ID token attached when signed in. Every page was
   * re-implementing this pairing, and each copy was a chance to forget it and
   * silently lose ownership checks or history.
   */
  authedFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  dismissError: () => {},
  token: async () => null,
  authedFetch: (input, init) => fetch(input, init),
});

/**
 * Firebase error codes, translated. The default behaviour of letting these
 * reject unhandled is what made a misconfigured domain look like a dead
 * button rather than a fixable error.
 */
function readableAuthError(err: unknown): string | null {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : "";

  switch (code) {
    // The user shut the popup. Not an error worth shouting about.
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null;
    case "auth/unauthorized-domain":
      return "This site isn't an authorised sign-in domain for the project yet.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/network-request-failed":
      return "Couldn't reach the sign-in service. Check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Google sign-in isn't enabled for this project.";
    default:
      return code
        ? `Sign-in failed (${code}).`
        : "Sign-in failed. Please try again.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Completes any sign-in that took the redirect path instead of a popup.
    void consumeRedirectResult();
    return watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const doSignIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Google sign-in failed", err);
      setError(readableAuthError(err));
    }
  }, []);

  const doSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      console.error("Sign-out failed", err);
      setError("Couldn't sign you out. Please try again.");
    }
  }, []);

  const dismissError = useCallback(() => setError(null), []);
  const token = useCallback(
    async () => (user ? user.getIdToken() : null),
    [user]
  );

  const authedFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const idToken = user ? await user.getIdToken() : null;
      const headers = new Headers(init.headers);
      if (idToken) headers.set("Authorization", `Bearer ${idToken}`);
      return fetch(input, { ...init, headers });
    },
    [user]
  );

  /**
   * Memoised deliberately. These closures are dependencies of `useCallback`
   * loaders in the judgment and history pages; rebuilding them on every
   * render re-ran those effects, which fired the expensive judgment
   * explanation request at least twice per page load.
   */
  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      error,
      signIn: doSignIn,
      signOut: doSignOut,
      dismissError,
      token,
      authedFetch,
    }),
    [user, loading, error, doSignIn, doSignOut, dismissError, token, authedFetch]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}
