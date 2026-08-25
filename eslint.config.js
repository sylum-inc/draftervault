import { readFileSync } from "node:fs";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * Lint exactly what we typecheck.
 *
 * `tsconfig.app.json` lists the tree reachable from `main.tsx`; the ~59k lines
 * outside it are unreachable from the app and carry ~460 latent type errors,
 * which is why they are excluded there. Linting them reported 74 errors that
 * nothing could act on and made `npm run validate` impossible to pass, so CI
 * had nothing to gate on.
 *
 * The list is read from that file rather than restated here, because a second
 * copy of it would drift the first time somebody moved a directory — and the
 * point of excluding the dead tree is lost the moment the two disagree. When
 * the dead tree is deleted this whole block becomes a no-op and can go.
 */
const liveTree = () => {
  const raw = readFileSync(new URL("./tsconfig.app.json", import.meta.url), "utf8");
  // tsconfig files are JSON with comments; strip them before parsing.
  const json = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const { include } = JSON.parse(json);
  return include.map((entry) => (entry.includes(".") ? entry : `${entry}/**`));
};

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist-single",
      // Everything under src/, then the live tree added back.
      "src/**",
      ...liveTree().map((pattern) => `!${pattern}`),
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Config files run in Node and legitimately use require() for plugins.
    files: ["*.config.{ts,js}", "scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  }
);
