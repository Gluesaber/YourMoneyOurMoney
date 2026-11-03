import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/node_modules/", "**/dist/", "**/coverage/", "playwright-report/", "test-results/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally unused parameters such as Express's `_req` and `_next`.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["server/**/*.ts", "e2e/**/*.ts", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["client/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.vitest } },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
