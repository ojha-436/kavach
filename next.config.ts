import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfjs-dist dynamically imports its worker relative to its own package
  // files at runtime; bundling it with webpack breaks that lookup in the
  // standalone build, so it needs to stay a real, unbundled node_modules dep.
  // firebase-admin resolves parts of itself at runtime and does not survive
  // webpack bundling cleanly, same class of problem as pdfjs-dist's worker.
  serverExternalPackages: ["pdfjs-dist", "firebase-admin"],
};

export default nextConfig;
