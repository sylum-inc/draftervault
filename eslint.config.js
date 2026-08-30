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
 * nothing could act on and made `npm run validate` impossible to pass.
 *
 * The list is read from that file rather than restated here, because a second
 * copy would drift the first time somebody moved a directory.
 *
 * It is expressed as `files`, NOT as `ignores: ["src/**", ...negations]`, and
 * that distinction was silently costing everything. A flat config prunes an
 * ignored directory before it considers any negation inside it, so `src/**`
 * with the live tree added back un-ignored nothing at all: `eslint .` reported
 * on eighteen files, none of them under `src/`. `npm run validate` passed and
 * CI gated on a lint that had not read a line of the application for the whole
 * life of the rule that claimed it did. Asking for a live file by name said so
 * plainly — "File ignored because of a matching ignore pattern" — which is a
 * warning worth reading rather than skimming past.
 */
const liveTree = () => {
  const raw = readFileSync(new URL("./tsconfig.app.json", import.meta.url), "utf8");
  // tsconfig files are JSON with comments; strip them before parsing.
  const json = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const { include } = JSON.parse(json);
  return include
    .map((entry) => (entry.includes(".") ? entry : `${entry}/**`))
    .flatMap((pattern) => (pattern.endsWith("/**") ? [`${pattern}/*.{ts,tsx}`, pattern] : [pattern]));
};

export default tseslint.config(
  {
    ignores: ["dist", "dist-single"],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    // The live tree only. Everything else under src/ is the dead tree, which is
    // unreachable from main.tsx and carries hundreds of latent errors.
    // The live tree, plus the root config files, which are TypeScript too and
    // need this block's parser to be readable at all.
    files: [...liveTree(), "*.ts", "*.tsx"],
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
    files: ["*.config.{ts,js}"],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    /**
     * The build scripts and the optional server, linted rather than merely
     * parsed.
     *
     * `node --check` proves a file is syntactically valid and nothing more, so
     * it happily accepted a pool builder that referenced a variable a refactor
     * had deleted — the failure only appeared minutes into a run, after the
     * downloads. `no-undef` catches that class before CI spends the bandwidth.
     *
     * `server/` is here for the same reason and one more: nothing typechecks
     * it — tsc reads `tsconfig.app.json`, which is the tree reachable from
     * `main.tsx` — so this rule is the only thing standing between a renamed
     * export in `serverContract.ts` and a server that starts and then throws on
     * the first request.
     */
    files: ["scripts/**/*.mjs", "server/**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      // `const { history, career, ...rest } = player` is how the builder drops
      // fields from what it writes. Naming them is the point, not an oversight.
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  }
);
