import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { NextRequest } from "next/server";

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? "promptwar-501405";

function admin() {
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
  }
  return getAuth();
}

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

/**
 * Resolves the caller from a Firebase ID token, or null for an anonymous
 * session. Anonymous is a supported state, not an error: analyses still work
 * signed out, they just expire in 24h instead of being saved to a profile.
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const idToken = header.slice("Bearer ".length).trim();
  if (!idToken) return null;

  try {
    const decoded = await admin().verifyIdToken(idToken);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null,
    };
  } catch {
    // A bad or expired token is treated as anonymous rather than a hard
    // failure: the user still gets their analysis, it just isn't saved.
    return null;
  }
}
