import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfjs-dist dynamically imports its worker relative to its own package
  // files at runtime; bundling it with webpack breaks that lookup in the
  // standalone build, so it needs to stay a real, unbundled node_modules dep.
  // firebase-admin resolves parts of itself at runtime and does not survive
  // webpack bundling cleanly, same class of problem as pdfjs-dist's worker.
  serverExternalPackages: ["pdfjs-dist", "firebase-admin"],

  // Google account avatars, so next/image can optimise and serve them
  // rather than shipping a raw <img> at whatever size Google returns.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },

  /**
   * Proxies Firebase's auth handler onto our own origin.
   *
   * Currently unused: src/lib/firebase-client.ts keeps authDomain pointed at
   * promptwar-501405.firebaseapp.com, because the Cloud Run handler URL is
   * not a registered OAuth redirect URI. Kept because it is the other half
   * of a same-origin sign-in flow — add
   * https://kavach-823065407403.asia-south1.run.app/__/auth/handler to the
   * OAuth client's authorized redirect URIs, flip authDomain to the app's
   * own host, and the flow stops depending on third-party cookies.
   */
  /**
   * The app renders untrusted text — uploaded contracts and court judgments —
   * so it should not be framable, should not leak referrers to third parties,
   * and should not let a browser sniff a response into a different type.
   */
  async headers() {
    /**
     * Content Security Policy.
     *
     * `script-src` carries 'unsafe-inline' deliberately, and it is worth
     * saying why rather than leaving it looking careless. A nonce-based
     * policy is stronger, but nonces are per-request and most of this app is
     * statically prerendered — the HTML is built once, so there is no request
     * in which to stamp a nonce. Forcing every page dynamic to enable nonces
     * would trade real, measurable performance for a hardening step whose
     * benefit here is small: the untrusted text this app renders (contracts,
     * judgments) goes through React, which escapes it, and there is no
     * dangerouslySetInnerHTML anywhere near user or document content.
     *
     * script-src also allows https://apis.google.com, and that one is not
     * optional. Firebase Auth's popup resolver loads Google's gapi client
     * from there to build the auth iframe, before it makes any network call
     * of its own. Blocking it does not degrade sign-in, it kills it: the
     * resolver never initialises and the SDK reports auth/internal-error,
     * which names nothing useful. This policy did block it, and sign-in was
     * broken from the moment the header was added until someone tried the
     * button — the accessibility suite never did, because every one of its
     * pages is signed out. There is a regression test for it now.
     */
    const csp = [
      "default-src 'self'",
      // apis.google.com: Firebase Auth's popup resolver. See above.
      "script-src 'self' 'unsafe-inline' https://apis.google.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.googleusercontent.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.googleapis.com https://*.google.com https://storage.googleapis.com",
      "frame-src 'self' https://promptwar-501405.firebaseapp.com https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Microphone stays enabled for same-origin: the Ask panel's
            // speech input needs it. Everything else is off.
            value: "camera=(), geolocation=(), microphone=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://promptwar-501405.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination: "https://promptwar-501405.firebaseapp.com/__/firebase/:path*",
      },
    ];
  },
};

export default nextConfig;
