// Règles de qualité de Wimm. `npm run lint` les vérifie, et la CI aussi.
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "server-dist", "node_modules", "tools", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // Un `catch {}` vide est volontaire (stockage local indisponible, etc.).
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Hooks : appelés toujours dans le même ordre, jamais sous condition.
      "react-hooks/rules-of-hooks": "error",
      // Dépendances des effets : signalées, sans bloquer.
      "react-hooks/exhaustive-deps": "warn",
      // Code mort : variables et imports inutilisés. Préfixe « _ » pour un
      // paramètre volontairement ignoré.
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none",
        ignoreRestSiblings: true,
      }],
    },
  },
);
