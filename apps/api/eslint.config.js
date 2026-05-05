import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Minimal API-side ESLint configuration. We rely on the root project's
 * hoisted `eslint` and `typescript-eslint` installs (no separate devDep
 * here to avoid duplicate-dependency churn). The root's `eslint.config.js`
 * explicitly ignores `apps/`, so when ESLint is run inside `apps/api`
 * with this file as the nearest config, it lints API sources only.
 */
export default tseslint.config(
  { ignores: ["dist", "node_modules", "**/*.tsbuildinfo"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      // `declare global { namespace Express { ... } }` is the canonical
      // way to augment Express request typings; the no-namespace rule
      // would force an unrelated rewrite for purely typing-side code.
      "@typescript-eslint/no-namespace": "off",
      // Imports use the `.js` suffix for NodeNext ESM compatibility, even
      // when the on-disk file is `.ts`. Don't flag this pattern.
      "no-empty-pattern": "off",
    },
  },
);
