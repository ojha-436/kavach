import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      // The load-bearing correctness logic. UI and cloud clients are
      // verified against the real deployment rather than mocked.
      exclude: ["src/lib/llm.ts", "src/lib/firestore-admin.ts", "src/lib/storage.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
