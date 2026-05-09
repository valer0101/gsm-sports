import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement scroll APIs; the wizard calls `window.scrollTo` on
// step changes and on submit-error to bring the banner into view. Stub it so
// component tests don't print "Not implemented" warnings. Specs that opt
// into `@vitest-environment node` (e.g. middleware.spec.ts) skip this branch.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
}

afterEach(() => {
  cleanup();
});
