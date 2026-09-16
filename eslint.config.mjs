import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import tseslint from "typescript-eslint";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

/**
 * `npm run lint` previously pointed at a config that did not exist, so
 * jsx-a11y and react-hooks rules had never run against this codebase once.
 * Several real accessibility defects survived to production because of it.
 */
export default [
  ...compat.extends("next/core-web-vitals", "plugin:jsx-a11y/recommended"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "scripts/**",
      "docs/**",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    rules: {
      // The product's correctness rests on validated structures, not on
      // loosely-typed model output being waved through.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // A scrollable region with no focusable children must itself be
      // focusable, or keyboard users cannot scroll it at all (WCAG 2.1.1).
      // The rule's default allow-list omits `region`, which is exactly the
      // role that pattern calls for.
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { tags: [], roles: ["tabpanel", "region"], allowExpressionValues: true },
      ],
    },
  },
];
