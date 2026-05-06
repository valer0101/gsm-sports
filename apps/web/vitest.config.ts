import { defineConfig } from 'vitest/config';

/**
 * Web tests for pure-logic helpers (slug, prize-calc, etc.).
 * Components that touch React/Next/DOM aren't covered here yet — when
 * those tests arrive, switch to `environment: 'jsdom'` and add
 * `@testing-library/react`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
