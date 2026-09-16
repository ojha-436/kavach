import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfjs-dist dynamically imports its worker relative to its own package
  // files at runtime; bundling it with webpack breaks that lookup in the
  // standalone build, so it needs to stay a real, unbundled node_modules dep.
  // firebase-admin resolves parts of itself at runtime and does not survive
  // webpack bundling cleanly, same class of problem as pdfjs-dist's worker.
  serverExternalPackages: ["pdfjs-dist", "firebase-admin"],

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
