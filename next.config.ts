import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfjs-dist dynamically imports its worker relative to its own package
  // files at runtime; bundling it with webpack breaks that lookup in the
  // standalone build, so it needs to stay a real, unbundled node_modules dep.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
