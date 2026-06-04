import config from '@dword-design/eslint-config';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['eslint.config.ts', 'eslint.lint-staged.config.ts', 'web-ext.config.ts']),
  config,
]);
