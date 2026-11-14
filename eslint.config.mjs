// ESLint flat config for Next.js
// Using manual config to avoid FlatCompat circular reference issues with Next.js configs
// Note: Next.js will still run its own ESLint during build, which will catch Next.js-specific issues

import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "notebooks/**",
      ".venv/**",
      "coverage/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // Basic rules - Next.js build will run its own ESLint with full Next.js rules
      "@typescript-eslint/no-unused-vars": "off", // TypeScript compiler handles this
    },
  },
  {
    // Type-aware rules. The TS program load costs about a second per run;
    // scoping to fewer files saved nothing, so this covers all TypeScript.
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Wind and weather data use null for "no data" and 0 as a real value,
      // so `x || fallback` silently discards a calm wind or a 0 degree
      // reading. Where "" or 0 should fall back on purpose, write the check
      // out explicitly.
      "@typescript-eslint/prefer-nullish-coalescing": "error",
    },
  },
];
