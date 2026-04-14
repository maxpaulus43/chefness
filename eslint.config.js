import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  // Global ignores
  { ignores: ["dist/**", "node_modules/**", "dev-dist/**", ".wrangler/**"] },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript strict type-checked rules
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // TypeScript parser options (needed for type-checked rules)
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
      },
    },
  },

  // React Hooks plugin
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // React Refresh plugin
  {
    plugins: {
      "react-refresh": reactRefresh,
    },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },

  // Project-specific rule overrides
  {
    rules: {
      // Allow unused vars that start with _ (common pattern for destructuring)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // The codebase uses void for fire-and-forget promises (e.g. void sendMessage(text))
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],

      // Allow empty catch blocks (used in the codebase for intentional swallowing)
      "@typescript-eslint/no-empty-function": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],

      // The codebase uses `as const` returns and type assertions in some places
      "@typescript-eslint/no-non-null-assertion": "warn",

      // Some strict rules are too noisy for this project — relax:
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
);
