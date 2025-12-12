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
];
