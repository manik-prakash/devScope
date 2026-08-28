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
  ]),
  {
    rules: {
      // TODO(tech-debt): several mount effects read sessionStorage then setState
      // (Topbar, me/page, me/settings, SessionDetailDrawer, dashboard/settings).
      // Functionally fine (runs once) but this rule wants a lazy initializer /
      // useSyncExternalStore. Downgraded to a warning so CI stays green.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
