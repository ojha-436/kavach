"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { watchAuth, signInWithGoogle, signOut, type User } from "@/lib/firebase-client";

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Bearer token for our own API routes; null when signed out. */
  token: () => Promise<string | null>;
};

const Ctx = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  token: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthState = {
    user,
    loading,
    signIn: async () => {
      await signInWithGoogle();
    },
    signOut: async () => {
      await signOut();
    },
    token: async () => (user ? user.getIdToken() : null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  return useContext(Ctx);
}
