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
   * Serve Firebase's auth handler from our own origin.
   *
   * By default the SDK sends the sign-in popup to
   * promptwar-501405.firebaseapp.com/__/auth/handler. That is a different
   * site from the app, so completing sign-in depends on third-party cookies
   * and cross-site storage — which browsers now partition by default, and
   * which is the usual reason a correctly configured popup sign-in still
   * fails. Proxying the handler here makes the whole flow same-origin.
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
