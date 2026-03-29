/**
 * Base ESLint flat config for shared library packages (ui-core, ui-auth, etc.).
 * Provides TypeScript + React rules via eslint-config-next/typescript.
 *
 * Usage in a shared package's eslint.config.mjs:
 *   import libraryConfig from '@corpdk/eslint-config';
 *   export default libraryConfig;
 */
import { defineConfig } from 'eslint/config';
import nextTs from 'eslint-config-next/typescript';

const libraryConfig = defineConfig([...nextTs]);

export default libraryConfig;
