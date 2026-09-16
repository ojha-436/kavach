"use client";

import { createContext, useContext, useEffect, useState } from "react";
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
};

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
  dismissError: () => {},
  token: async () => null,
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

  const value: AuthState = {
    user,
    loading,
    error,
    signIn: async () => {
      setError(null);
      try {
        await signInWithGoogle();
      } catch (err) {
        console.error("Google sign-in failed", err);
        setError(readableAuthError(err));
      }
    },
    signOut: async () => {
      try {
        await signOut();
      } catch (err) {
        console.error("Sign-out failed", err);
        setError("Couldn't sign you out. Please try again.");
      }
    },
    dismissError: () => setError(null),
    token: async () => (user ? user.getIdToken() : null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}
