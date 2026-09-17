import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The claim being tested: a build given no Firebase configuration still
 * produces a working app, with sign-in reporting itself unavailable rather
 * than throwing at import time and taking every page down with it.
 *
 * That is not a hypothetical. CI builds exactly that way — it is handed no
 * credentials on purpose — and then runs the whole accessibility suite
 * against the result. If this degradation broke, CI would start failing on
 * pages that have nothing to do with authentication.
 *
 * The SDK itself is never imported here: firebase-client only reaches for it
 * inside functions, and every one of those returns early when unconfigured.
 */
const FIREBASE_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

async function loadWith(env: Record<string, string>) {
  vi.resetModules();
  for (const key of FIREBASE_ENV) delete process.env[key];
  Object.assign(process.env, env);
  return import("./firebase-client");
}

beforeEach(() => {
  for (const key of FIREBASE_ENV) delete process.env[key];
});

describe("firebase-client without configuration", () => {
  it("reports itself unconfigured", async () => {
    const mod = await loadWith({});
    expect(mod.authConfigured()).toBe(false);
  });

  it("reports signed out rather than hanging, and unsubscribes cleanly", async () => {
    const mod = await loadWith({});
    const seen: Array<unknown> = [];
    const unsubscribe = mod.watchAuth((u) => seen.push(u));
    expect(seen).toEqual([null]);
    expect(() => unsubscribe()).not.toThrow();
  });

  it("fails sign-in with a code the UI has a message for", async () => {
    const mod = await loadWith({});
    await expect(mod.signInWithGoogle()).rejects.toMatchObject({
      code: "auth/not-configured",
    });
  });

  it("makes sign-out and redirect pickup no-ops instead of crashes", async () => {
    const mod = await loadWith({});
    await expect(mod.signOut()).resolves.toBeUndefined();
    await expect(mod.consumeRedirectResult()).resolves.toBeNull();
  });
});

describe("firebase-client with configuration", () => {
  it("is configured once the two identifying values are present", async () => {
    const mod = await loadWith({
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:2:web:3",
    });
    expect(mod.authConfigured()).toBe(true);
  });

  it("stays unconfigured when only part of the config arrives", async () => {
    // A half-populated deploy is worse than an empty one: it would get past
    // the guard and fail later, inside the SDK, with a less obvious message.
    const mod = await loadWith({ NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key" });
    expect(mod.authConfigured()).toBe(false);
  });
});
