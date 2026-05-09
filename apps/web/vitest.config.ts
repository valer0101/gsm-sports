import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Web tests cover both pure logic (slug, prize-calc, i18n config) and
 * React components rendered with `@testing-library/react`. jsdom is the
 * environment so DOM globals and `localStorage` are available; component
 * specs live next to source as `*.spec.tsx`.
 *
 * `esbuild.jsx = 'automatic'` matches the Next.js compiler so component
 * specs don't have to `import React`.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
