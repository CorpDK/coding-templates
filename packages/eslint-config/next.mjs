/**
 * ESLint flat config for Next.js application templates (ui, ui-showcase, etc.).
 * Extends the base library config with core-web-vitals rules.
 *
 * Usage in a Next.js template's eslint.config.mjs:
 *   import nextConfig from '@corpdk/eslint-config/next';
 *   export default nextConfig;
 */
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const nextConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);

export default nextConfig;
