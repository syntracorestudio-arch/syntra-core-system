import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /* Generado por `supabase start` (runtime de edge functions, minificado).
       No es código nuestro y metía 99 errores de `no-var`/`prefer-const` que
       tapaban los reales. Ya está gitignoreado; esto lo saca también del lint. */
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
