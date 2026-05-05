import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    // Inject test-safe env defaults before any test imports
    // `@/config/env`, which eagerly validates `process.env` at module
    // load. See `tests/setup.env.ts` for the rationale.
    setupFiles: ['./tests/setup.env.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
});
